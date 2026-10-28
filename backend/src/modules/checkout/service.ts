import { priceSelection } from "../catalog/pricing";
import type { ResolvedProduct } from "../catalog/types";
import { addressDto, toOrderDto, toOrderSummary, type OrderDto } from "./order-dto";
import { computeQuote, zoneForPostcode, type CouponRule, type ZoneRule } from "./quote";
import type { AddressCreate, AddressUpdate, CartItemInput, CheckoutRequest, QuoteRequest } from "./schemas";
import { hashToken, newDeviceToken } from "./token";
import type { RestaurantStatus } from "../settings/service";
import type { AddressRow, Customer, OrderBundle, OrderRow, PlaceOrderPayload } from "./types";

export class CheckoutError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details: unknown[] = []) {
    super(message);
    this.name = "CheckoutError";
  }
}

/** Everything the service needs from storage. A fake in tests, Supabase in production (./repository). */
export interface CheckoutRepository {
  createCustomer(tokenHash: string): Promise<Customer>;
  customerByTokenHash(hash: string): Promise<Customer | null>;
  touchCustomer(id: string): Promise<void>;
  /** Remembers the last name and phone given at checkout. Best effort: failing to save must not fail an order. */
  saveContact(customerId: string, name: string | null, phone: string | null): Promise<void>;
  addresses(customerId: string): Promise<AddressRow[]>;
  address(customerId: string, id: string): Promise<AddressRow | null>;
  insertAddress(customerId: string, fields: Omit<AddressRow, "id" | "customer_id">): Promise<AddressRow>;
  updateAddress(customerId: string, id: string, patch: Partial<Omit<AddressRow, "id" | "customer_id">>): Promise<AddressRow | null>;
  deleteAddress(customerId: string, id: string): Promise<boolean>;
  clearDefaultAddress(customerId: string): Promise<void>;
  zones(): Promise<ZoneRule[]>;
  couponByCode(code: string): Promise<CouponRule | null>;
  /** Runs the database's atomic, idempotent checkout. Throws CheckoutError for COUPON_LIMIT and COUPON_INVALID. */
  placeOrder(payload: PlaceOrderPayload): Promise<{ orderId: string; created: boolean }>;
  order(customerId: string, orderId: string): Promise<OrderBundle | null>;
  /** The order this customer already placed with this idempotency key, if any. */
  orderByKey(customerId: string, idempotencyKey: string): Promise<OrderBundle | null>;
  orders(customerId: string): Promise<OrderRow[]>;
}

export interface CheckoutDeps {
  repo: CheckoutRepository;
  /** The product as customers see it (resolved, active, in a visible category), or null. */
  loadProduct: (id: string) => Promise<ResolvedProduct | null>;
  /** Whether the restaurant takes orders now (opening hours, the on/off switch) and its ordering rules. Defaults to always open. */
  restaurantStatus?: () => Promise<RestaurantStatus>;
  /** Called once when an order is created (not when a retry returns an existing one). Must not throw; a failure here never fails the order. */
  onOrderPlaced?: (order: OrderDto) => void;
  now?: () => Date;
}

const MAX_ADDRESSES = 10;

const ALWAYS_OPEN: RestaurantStatus = { open: true, reason: null, message: "", extraPrepMinutes: 0, requireContactDetails: false };

export function createCheckoutService({ repo, loadProduct, restaurantStatus = async () => ALWAYS_OPEN, onOrderPlaced, now = () => new Date() }: CheckoutDeps) {
  // last_seen_at is for housekeeping only. Writing it on every request cost a database round trip each time, so it is written
  // at most once every ten minutes per customer on each server instance.
  const lastTouched = new Map<string, number>();
  const TOUCH_EVERY_MS = 10 * 60_000;
  const knownTokens = new Map<string, { customer: Customer; until: number }>();
  const KNOWN_TOKEN_MS = 30_000;

  async function priceItems(items: CartItemInput[]) {
    const cache = new Map<string, ResolvedProduct | null>();
    const lines = [];
    for (const item of items) {
      if (!cache.has(item.product_id)) cache.set(item.product_id, await loadProduct(item.product_id));
      const product = cache.get(item.product_id);
      if (!product) {
        throw new CheckoutError(400, "ITEM_UNAVAILABLE", "An item in your cart isn’t available anymore. Remove it and try again.", [{ product_id: item.product_id }]);
      }
      const result = priceSelection(product, { portionKey: item.portion_key, optionIds: item.option_ids, quantity: item.quantity }, { forDelivery: true });
      if (!result.ok) {
        throw new CheckoutError(400, "ITEM_UNAVAILABLE", `${product.name}: ${result.issues[0].message}`, result.issues.map((i) => ({ product_id: item.product_id, code: i.code, message: i.message })));
      }
      lines.push({ item, product, priced: result });
    }
    return lines;
  }

  async function addressContext(customerId: string, addressId: string | undefined) {
    if (!addressId) return { address: null, zone: null, outside: false };
    const [address, zones] = await Promise.all([repo.address(customerId, addressId), repo.zones()]);
    if (!address) throw new CheckoutError(404, "ADDRESS_NOT_FOUND", "Pick a delivery address and try again.");
    const zone = zoneForPostcode(zones, address.postal_code);
    return { address, zone, outside: zone === null };
  }

  function toQuoteError(issue: { code: string; message: string; shortByMinor?: number }) {
    return new CheckoutError(issue.code === "NOT_DELIVERED" ? 422 : 400, issue.code, issue.message, issue.shortByMinor === undefined ? [] : [{ short_by_minor: issue.shortByMinor }]);
  }

  return {
    // ---- Guests ----------------------------------------------------------------------------------------------------------
    async registerGuest() {
      const token = newDeviceToken();
      const customer = await repo.createCustomer(hashToken(token));
      return { token, customer_id: customer.id };
    },

    async authenticate(token: string): Promise<Customer | null> {
      const hash = hashToken(token);
      const at = now().getTime();
      // The same phone asks many times a minute (order tracking polls). Looking the customer up each time cost a database round trip, so a
      // known token is remembered for 30 seconds. A block or a changed name takes up to that long to reach this server instance; the
      // database function that places an order refuses a blocked customer itself, so that cannot be bypassed. An unknown token is never
      // remembered, so a phone that has just registered is recognised at once.
      const known = knownTokens.get(hash);
      if (known && known.until > at) return known.customer;
      const customer = await repo.customerByTokenHash(hash);
      if (!customer) { knownTokens.delete(hash); return null; }
      if (knownTokens.size > 2000) knownTokens.clear();
      knownTokens.set(hash, { customer, until: at + KNOWN_TOKEN_MS });
      if (at - (lastTouched.get(customer.id) ?? 0) >= TOUCH_EVERY_MS) {
        if (lastTouched.size > 5000) lastTouched.clear();
        lastTouched.set(customer.id, at);
        await repo.touchCustomer(customer.id).catch(() => undefined);
      }
      return customer;
    },

    // ---- Addresses ----------------------------------------------------------------------------------------------------------
    async listAddresses(customer: Customer) {
      return (await repo.addresses(customer.id)).map(addressDto);
    },

    async createAddress(customer: Customer, input: AddressCreate) {
      const existing = await repo.addresses(customer.id);
      if (existing.length >= MAX_ADDRESSES) throw new CheckoutError(400, "TOO_MANY_ADDRESSES", `You can save up to ${MAX_ADDRESSES} addresses. Delete one first.`);
      const makeDefault = input.is_default === true || existing.length === 0;
      if (makeDefault) await repo.clearDefaultAddress(customer.id);
      const row = await repo.insertAddress(customer.id, {
        label: input.label, line1: input.line1, locality: input.locality, city: input.city, postal_code: input.postal_code,
        instructions: input.instructions ?? null, is_default: makeDefault,
      });
      return addressDto(row);
    },

    async updateAddress(customer: Customer, id: string, patch: AddressUpdate) {
      if (!(await repo.address(customer.id, id))) throw new CheckoutError(404, "ADDRESS_NOT_FOUND", "That address does not exist.");
      if (patch.is_default === true) await repo.clearDefaultAddress(customer.id);
      const row = await repo.updateAddress(customer.id, id, patch);
      if (!row) throw new CheckoutError(404, "ADDRESS_NOT_FOUND", "That address does not exist.");
      return addressDto(row);
    },

    async deleteAddress(customer: Customer, id: string) {
      const target = await repo.address(customer.id, id);
      if (!target) throw new CheckoutError(404, "ADDRESS_NOT_FOUND", "That address does not exist.");
      await repo.deleteAddress(customer.id, id);
      if (target.is_default) {
        const next = (await repo.addresses(customer.id))[0];
        if (next) await repo.updateAddress(customer.id, next.id, { is_default: true });
      }
    },

    // ---- Quote and checkout ----------------------------------------------------------------------------------------------------
    /** Prices a cart. Every figure comes from the catalog and the rules; the request carries ids and quantities only. */
    async quote(customer: Customer, req: QuoteRequest) {
      const lines = await priceItems(req.items);
      const status = await restaurantStatus();
      const context = addressContext(customer.id, req.address_id);
      const couponLookup = req.coupon_code ? repo.couponByCode(req.coupon_code) : Promise.resolve(null);
      context.catch(() => undefined); couponLookup.catch(() => undefined); // reported below, in order, not as an unhandled rejection
      const { zone, outside } = await context;
      const coupon = await couponLookup;
      const result = computeQuote({
        lines: lines.map((l) => ({ lineTotalMinor: l.priced.totalMinor })),
        coupon, couponRequested: !!req.coupon_code, zone, addressOutsideArea: outside, now: now(),
      });
      if (!result.ok) throw toQuoteError(result.issue);
      const q = result.quote;
      return {
        currency: "EUR",
        lines: lines.map((l) => ({
          product_id: l.item.product_id, name: l.product.name, portion_key: l.item.portion_key, portion: l.priced.portionLabel,
          options: l.priced.options.map((o) => o.name), quantity: l.item.quantity,
          unit_price_minor: l.priced.unitPriceMinor, line_total_minor: l.priced.totalMinor,
        })),
        subtotal_minor: q.subtotalMinor, discount_minor: q.discountMinor, tax_minor: q.taxMinor, delivery_fee_minor: q.deliveryFeeMinor,
        total_minor: q.totalMinor, coupon_code: q.couponCode,
        delivery: { minimum_order_minor: q.minimumOrderMinor, meets_minimum: q.meetsMinimum, estimated_minutes: withPrep(q.estimatedMinutes, status) },
        // So the cart can say "closed" before the customer fills in anything.
        restaurant: { open: status.open, message: status.message, require_contact_details: status.requireContactDetails },
      };
    },

    /** Places an order. Everything is priced again here; a retry with the same idempotency key returns the same order. */
    async checkout(customer: Customer, req: CheckoutRequest): Promise<OrderDto> {
      // A retry (same key) gets the order that was already placed, without pricing again: the menu or a coupon may have changed since.
      const prior = await repo.orderByKey(customer.id, req.idempotency_key);
      if (prior) return replay(prior, req.items);

      if (customer.isBlocked) throw new CheckoutError(403, "CUSTOMER_BLOCKED", "We can’t take orders from this device. Please call the restaurant.");
      const status = await restaurantStatus();
      if (!status.open) throw new CheckoutError(409, "RESTAURANT_CLOSED", status.message);
      const contactName = req.contact_name?.trim() || customer.fullName || null;
      const contactPhone = req.contact_phone?.trim() || customer.phone || null;
      if (status.requireContactDetails && (!contactName || !contactPhone)) {
        throw new CheckoutError(400, "CONTACT_REQUIRED", "Enter your name and phone number so the driver can reach you.");
      }

      const pricing = priceItems(req.items);
      const context = addressContext(customer.id, req.address_id);
      const couponLookup = req.coupon_code ? repo.couponByCode(req.coupon_code) : Promise.resolve(null);
      pricing.catch(() => undefined); context.catch(() => undefined); couponLookup.catch(() => undefined); // reported below, in order
      const lines = await pricing;
      const { address, zone, outside } = await context;
      if (!address) throw new CheckoutError(404, "ADDRESS_NOT_FOUND", "Pick a delivery address and try again.");
      const coupon = await couponLookup;
      const result = computeQuote({
        lines: lines.map((l) => ({ lineTotalMinor: l.priced.totalMinor })),
        coupon, couponRequested: !!req.coupon_code, zone, addressOutsideArea: outside, requireZone: true, now: now(),
      });
      if (!result.ok) throw toQuoteError(result.issue);
      const q = result.quote;

      const payload: PlaceOrderPayload = {
        customer_id: customer.id, idempotency_key: req.idempotency_key, payment_method: req.payment_method, currency: "EUR",
        subtotal_minor: q.subtotalMinor, discount_minor: q.discountMinor, tax_minor: q.taxMinor, delivery_fee_minor: q.deliveryFeeMinor,
        total_minor: q.totalMinor, coupon_id: q.couponId, coupon_code: q.couponCode, delivery_zone_id: q.zoneId,
        estimated_minutes: withPrep(q.estimatedMinutes, status), contact_name: contactName, contact_phone: contactPhone,
        address: { label: address.label, line1: address.line1, locality: address.locality, city: address.city, postal_code: address.postal_code, instructions: req.instructions?.trim() || address.instructions },
        items: lines.map((l) => ({
          product_id: l.item.product_id, portion_key: l.item.portion_key, product_name: l.product.name, portion_label: l.priced.portionLabel,
          quantity: l.item.quantity, unit_price_minor: l.priced.unitPriceMinor, line_total_minor: l.priced.totalMinor,
          options: l.priced.options.map((o) => ({ option_id: o.optionId, group_name: o.groupName, option_name: o.name, price_minor: o.priceMinor })),
        })),
      };
      const placed = await repo.placeOrder(payload);
      if (req.contact_name || req.contact_phone) await repo.saveContact(customer.id, contactName, contactPhone).catch(() => undefined);
      const bundle = await repo.order(customer.id, placed.orderId);
      if (!bundle) throw new Error("checkout: the order was placed but could not be read back");

      if (!placed.created) return replay(bundle, req.items); // a concurrent request with the same key won: no second alert
      const dto = toOrderDto(bundle);
      try { onOrderPlaced?.(dto); } catch { /* an alert must never fail an order */ }
      return dto;
    },

    // ---- Orders ----------------------------------------------------------------------------------------------------------------
    async listOrders(customer: Customer) {
      return { items: (await repo.orders(customer.id)).map(toOrderSummary) };
    },

    async getOrder(customer: Customer, id: string): Promise<OrderDto> {
      const bundle = await repo.order(customer.id, id);
      if (!bundle) throw new CheckoutError(404, "ORDER_NOT_FOUND", "That order does not exist.");
      return toOrderDto(bundle);
    },
  };
}

export type CheckoutService = ReturnType<typeof createCheckoutService>;

/** The zone's estimate plus the extra minutes the kitchen asked for while it is busy. */
const withPrep = (minutes: number | null, status: RestaurantStatus) => (minutes === null ? null : minutes + status.extraPrepMinutes);

/**
 * The same key used for a different cart is a client bug, not a retry: say so instead of returning an unrelated order.
 * Compared on products, sizes, options and quantities only (prices may have moved since).
 */
function replay(bundle: OrderBundle, items: CartItemInput[]): OrderDto {
  const stored = bundle.items
    .map((i) => `${i.product_id}|${i.portion_key}|${i.quantity}|${bundle.options.filter((o) => o.order_item_id === i.id).map((o) => o.option_id).sort().join(",")}`)
    .sort();
  const wanted = items.map((i) => `${i.product_id}|${i.portion_key}|${i.quantity}|${[...i.option_ids].sort().join(",")}`).sort();
  if (stored.length !== wanted.length || stored.some((s, i) => s !== wanted[i])) {
    throw new CheckoutError(409, "IDEMPOTENCY_CONFLICT", "That request key was already used for a different order. Start a new order.");
  }
  return toOrderDto(bundle);
}
