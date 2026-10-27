import { describe, expect, it } from "vitest";
import type { ResolvedProduct } from "../catalog/types";
import { toOrderDto } from "./order-dto";
import type { CouponRule, ZoneRule } from "./quote";
import { CheckoutError, createCheckoutService, type CheckoutRepository } from "./service";
import type { RestaurantStatus } from "../settings/service";
import type { AddressRow, Customer, OrderBundle, OrderItemRow, OrderOptionRow, PlaceOrderPayload } from "./types";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const SALAMI = uuid(1), BEER = uuid(2), CHAMP = uuid(11), HAM = uuid(12);
const salami: ResolvedProduct = {
  id: SALAMI, category_id: uuid(100), name: "Salami", description: "", image_url: null, thumb_url: null, diet: "non_veg", is_spicy: false, is_bestseller: false, is_new: false,
  allergens: [], fulfillment: "delivery_and_pickup", tags: [], currency: "EUR",
  portions: [{ key: "klein", label: "Klein 28 cm", price_minor: 700, available: true }, { key: "gross", label: "Groß 32 cm", price_minor: 900, available: true }],
  groups: [{ id: uuid(50), name: "Extra Zutaten", kind: "extra", min: 0, max: 5, required: false, options: [
    { id: CHAMP, name: "Champignons", is_default: false, prices: { klein: 50, gross: 100 } },
    { id: HAM, name: "Schinken", is_default: false, prices: { klein: 50, gross: 100 } },
  ] }],
};
const beer: ResolvedProduct = { ...salami, id: BEER, name: "Bier", fulfillment: "pickup_only", groups: [], portions: [{ key: "standard", label: "0,5 l", price_minor: 200, available: true }] };

const mitte: ZoneRule = { id: uuid(70), name: "Wesel-Mitte", postalCodes: ["46483"], minimumOrderMinor: 1000, deliveryFeeMinor: 0, estimatedMinutes: 35, isActive: true };
const outer: ZoneRule = { id: uuid(71), name: "Außenbezirke", postalCodes: ["46487"], minimumOrderMinor: 2000, deliveryFeeMinor: 0, estimatedMinutes: 45, isActive: true };
const welcome: CouponRule = { id: uuid(80), code: "WELCOME5", discountType: "fixed", discountValue: 500, minimumOrderMinor: 2000, maximumDiscountMinor: null, startsAt: null, expiresAt: null, isActive: true };

function fakeRepo() {
  const customers = new Map<string, Customer & { hash: string }>();
  const addresses: AddressRow[] = [];
  const orders: OrderBundle[] = [];
  const keys = new Map<string, string>();
  let nextAddress = 1000, nextOrder = 1050, nextCustomer = 1;
  const repo: CheckoutRepository & { _orders: OrderBundle[]; _addresses: AddressRow[]; _customers: Map<string, Customer & { hash: string }> } = {
    _orders: orders, _addresses: addresses, _customers: customers,
    async createCustomer(hash) { const c = { id: uuid(500 + nextCustomer++), fullName: null, phone: null, isBlocked: false, hash }; customers.set(hash, c); return c; },
    async customerByTokenHash(hash) { return customers.get(hash) ?? null; },
    async touchCustomer() {},
    async saveContact(customerId, name, phone) { for (const c of customers.values()) if (c.id === customerId) { c.fullName = name; c.phone = phone; } },
    async addresses(customerId) { return addresses.filter((a) => a.customer_id === customerId); },
    async address(customerId, id) { return addresses.find((a) => a.customer_id === customerId && a.id === id) ?? null; },
    async insertAddress(customerId, fields) { const row = { id: uuid(nextAddress++), customer_id: customerId, ...fields }; addresses.push(row); return row; },
    async updateAddress(customerId, id, patch) { const row = addresses.find((a) => a.customer_id === customerId && a.id === id); if (!row) return null; Object.assign(row, patch); return row; },
    async deleteAddress(customerId, id) { const i = addresses.findIndex((a) => a.customer_id === customerId && a.id === id); if (i < 0) return false; addresses.splice(i, 1); return true; },
    async clearDefaultAddress(customerId) { addresses.filter((a) => a.customer_id === customerId).forEach((a) => { a.is_default = false; }); },
    async zones() { return [mitte, outer]; },
    async couponByCode(code) { return code === "WELCOME5" ? welcome : null; },
    async placeOrder(p: PlaceOrderPayload) {
      const existing = keys.get(`${p.customer_id}|${p.idempotency_key}`);
      if (existing) return { orderId: existing, created: false };
      const id = uuid(900 + orders.length);
      const items: OrderItemRow[] = p.items.map((i, n) => ({ id: uuid(2000 + orders.length * 10 + n), order_id: id, product_id: i.product_id, portion_key: i.portion_key, product_name: i.product_name, portion_label: i.portion_label, quantity: i.quantity, unit_price_minor: i.unit_price_minor, line_total_minor: i.line_total_minor }));
      const options: OrderOptionRow[] = p.items.flatMap((i, n) => i.options.map((o) => ({ order_item_id: items[n].id, option_id: o.option_id, group_name: o.group_name, option_name: o.option_name, price_minor: o.price_minor })));
      orders.push({
        order: {
          id, order_number: `CC-${nextOrder++}`, customer_id: p.customer_id, status: "placed", payment_method: p.payment_method, payment_status: p.payment_method === "cod" ? "pending" : "demo_paid",
          currency: p.currency, subtotal_minor: p.subtotal_minor, discount_minor: p.discount_minor, tax_minor: p.tax_minor, delivery_fee_minor: p.delivery_fee_minor, total_minor: p.total_minor,
          coupon_code: p.coupon_code, estimated_minutes: p.estimated_minutes, delivery_label: p.address.label, delivery_line1: p.address.line1, delivery_locality: p.address.locality,
          delivery_city: p.address.city, delivery_postal_code: p.address.postal_code, delivery_instructions: p.address.instructions, contact_name: p.contact_name, contact_phone: p.contact_phone, created_at: "2026-10-20T12:00:00Z",
        },
        items, options, history: [{ new_status: "placed", reason: null, created_at: "2026-10-20T12:00:00Z", actor_label: "system" }],
      });
      keys.set(`${p.customer_id}|${p.idempotency_key}`, id);
      return { orderId: id, created: true };
    },
    async order(customerId, orderId) { return orders.find((o) => o.order.id === orderId && o.order.customer_id === customerId) ?? null; },
    async orderByKey(customerId, key) { const id = keys.get(`${customerId}|${key}`); return id ? orders.find((o) => o.order.id === id) ?? null : null; },
    async orders(customerId) { return orders.filter((o) => o.order.customer_id === customerId).map((o) => o.order); },
  };
  return repo;
}

const OPEN: RestaurantStatus = { open: true, reason: null, message: "", extraPrepMinutes: 0, requireContactDetails: false };

function setup() {
  const repo = fakeRepo();
  const menu = { removed: false };
  const restaurant = { status: OPEN as RestaurantStatus };
  const svc = createCheckoutService({
    repo, now: () => new Date("2026-10-20T12:00:00Z"), restaurantStatus: async () => restaurant.status,
    loadProduct: async (id) => (menu.removed ? null : id === SALAMI ? salami : id === BEER ? beer : null),
  });
  return { repo, svc, menu, restaurant };
}

async function guest(svc: ReturnType<typeof setup>["svc"]) {
  const { token } = await svc.registerGuest();
  return (await svc.authenticate(token))!;
}

const home = { label: "Home", line1: "Hohe Straße 12", locality: "Wesel-Mitte", city: "Wesel", postal_code: "46483" };
const item = (over: Record<string, unknown> = {}) => ({ product_id: SALAMI, portion_key: "gross", option_ids: [CHAMP], quantity: 2, ...over }) as never;
const fail = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e as CheckoutError; } throw new Error("expected an error"); };

describe("guests", () => {
  it("get a token once, and are recognised by it; a wrong token is nobody", async () => {
    const { svc } = setup();
    const { token, customer_id } = await svc.registerGuest();
    expect((await svc.authenticate(token))?.id).toBe(customer_id);
    expect(await svc.authenticate(token + "x")).toBeNull();
  });

  it("are stored only by the hash of their token", async () => {
    const { svc, repo } = setup();
    const { token } = await svc.registerGuest();
    expect([...repo._customers.keys()][0]).not.toContain(token);
  });
});

describe("addresses", () => {
  it("the first address is the default, a later one only when asked, and asking moves the default", async () => {
    const { svc } = setup();
    const c = await guest(svc);
    const a = await svc.createAddress(c, home);
    const b = await svc.createAddress(c, { ...home, label: "Work" });
    expect([a.is_default, b.is_default]).toEqual([true, false]);
    const w = await svc.createAddress(c, { ...home, label: "Parents", is_default: true });
    const all = await svc.listAddresses(c);
    expect(all.filter((x) => x.is_default).map((x) => x.label)).toEqual(["Parents"]);
    expect(w.one_line).toBe("Hohe Straße 12, Wesel-Mitte, 46483 Wesel");
  });

  it("deleting the default promotes another", async () => {
    const { svc } = setup();
    const c = await guest(svc);
    const a = await svc.createAddress(c, home);
    await svc.createAddress(c, { ...home, label: "Work" });
    await svc.deleteAddress(c, a.id);
    expect((await svc.listAddresses(c)).map((x) => [x.label, x.is_default])).toEqual([["Work", true]]);
  });

  it("belong to one customer: nobody can see, change or delete another's", async () => {
    const { svc } = setup();
    const mine = await guest(svc);
    const theirs = await guest(svc);
    const a = await svc.createAddress(mine, home);
    expect(await svc.listAddresses(theirs)).toEqual([]);
    expect((await fail(svc.updateAddress(theirs, a.id, { label: "Hacked" }))).code).toBe("ADDRESS_NOT_FOUND");
    expect((await fail(svc.deleteAddress(theirs, a.id))).code).toBe("ADDRESS_NOT_FOUND");
  });

  it("are limited to ten per customer", async () => {
    const { svc } = setup();
    const c = await guest(svc);
    for (let i = 0; i < 10; i++) await svc.createAddress(c, { ...home, label: `A${i}` });
    expect((await fail(svc.createAddress(c, home))).code).toBe("TOO_MANY_ADDRESSES");
  });
});

describe("quote", () => {
  it("prices from the catalog: portion plus extras for that size, times quantity", async () => {
    const { svc } = setup();
    const c = await guest(svc);
    const q = await svc.quote(c, { items: [item()] });
    expect(q).toMatchObject({ subtotal_minor: 2000, total_minor: 2000, delivery_fee_minor: 0, tax_minor: 0, discount_minor: 0 });
    expect(q.lines[0]).toMatchObject({ name: "Salami", portion: "Groß 32 cm", options: ["Champignons"], unit_price_minor: 1000, line_total_minor: 2000 });
  });

  it("ignores any price the client sends", async () => {
    const { svc } = setup();
    const c = await guest(svc);
    const q = await svc.quote(c, { items: [item({ price: 1, unit_price_minor: 1, total_minor: 1 })] });
    expect(q.total_minor).toBe(2000);
  });

  it("applies a coupon and explains one that does not qualify", async () => {
    const { svc } = setup();
    const c = await guest(svc);
    expect((await svc.quote(c, { items: [item()], coupon_code: "WELCOME5" })).total_minor).toBe(1500);
    const small = await fail(svc.quote(c, { items: [item({ quantity: 1 })], coupon_code: "WELCOME5" }));
    expect(small).toMatchObject({ code: "COUPON_MINIMUM", status: 400 });
    expect(small.message).toBe("Add 10,00 € more to use WELCOME5.");
    expect((await fail(svc.quote(c, { items: [item()], coupon_code: "NOPE" }))).code).toBe("COUPON_INVALID");
  });

  it("refuses products that are gone, sizes that do not exist and pickup-only items", async () => {
    const { svc } = setup();
    const c = await guest(svc);
    expect((await fail(svc.quote(c, { items: [item({ product_id: uuid(99) })] }))).code).toBe("ITEM_UNAVAILABLE");
    expect((await fail(svc.quote(c, { items: [item({ portion_key: "huge" })] }))).message).toContain("portion");
    const pickup = await fail(svc.quote(c, { items: [item({ product_id: BEER, portion_key: "standard", option_ids: [] })] }));
    expect(pickup.message).toContain("only available for pickup");
  });

  it("knows the minimum for a saved address and refuses areas we do not serve", async () => {
    const { svc } = setup();
    const c = await guest(svc);
    const near = await svc.createAddress(c, home);
    const q = await svc.quote(c, { items: [item({ quantity: 1 })], address_id: near.id });
    expect(q.delivery).toEqual({ minimum_order_minor: 1000, meets_minimum: true, estimated_minutes: 35 });
    const far = await svc.createAddress(c, { ...home, postal_code: "50667" });
    expect((await fail(svc.quote(c, { items: [item()], address_id: far.id }))).code).toBe("NOT_DELIVERED");
    expect((await fail(svc.quote(c, { items: [item()], address_id: uuid(9999) }))).code).toBe("ADDRESS_NOT_FOUND");
  });
});

describe("checkout", () => {
  const key = (n: number) => `key-${String(n).padStart(6, "0")}`;

  it("places an order priced by the server, as a snapshot", async () => {
    const { svc, repo } = setup();
    const c = await guest(svc);
    const a = await svc.createAddress(c, home);
    const order = await svc.checkout(c, { idempotency_key: key(1), address_id: a.id, payment_method: "cod", items: [item()], instructions: "Ring twice" });
    expect(order).toMatchObject({ number: "CC-1050", status: "placed", subtotal_minor: 2000, total_minor: 2000, payment_method: "cod", payment_status: "pending", estimated_minutes: 35 });
    expect(order.lines[0]).toMatchObject({ name: "Salami", portion: "Groß 32 cm", options: ["Champignons"], quantity: 2, line_total_minor: 2000 });
    expect(order.delivery.instructions).toBe("Ring twice");
    expect(order.delivery_address).toBe("Hohe Straße 12, Wesel-Mitte, 46483 Wesel");
    expect(repo._orders).toHaveLength(1);
  });

  it("applies the coupon at checkout and records it", async () => {
    const { svc } = setup();
    const c = await guest(svc);
    const a = await svc.createAddress(c, home);
    const order = await svc.checkout(c, { idempotency_key: key(2), address_id: a.id, payment_method: "cod", coupon_code: "WELCOME5", items: [item()] });
    expect(order).toMatchObject({ discount_minor: 500, total_minor: 1500, coupon_code: "WELCOME5", payment_status: "pending" });
  });

  it("enforces the minimum order of the area", async () => {
    const { svc, repo } = setup();
    const c = await guest(svc);
    const mitteAddr = await svc.createAddress(c, home);
    const outerAddr = await svc.createAddress(c, { ...home, postal_code: "46487" });
    const tooSmall = await fail(svc.checkout(c, { idempotency_key: key(3), address_id: outerAddr.id, payment_method: "cod", items: [item({ quantity: 1 })] }));
    expect(tooSmall.code).toBe("MINIMUM_ORDER");
    expect(tooSmall.message).toContain("Add 10,00 € more");
    expect(tooSmall.details).toEqual([{ short_by_minor: 1000 }]);
    expect((await svc.checkout(c, { idempotency_key: key(4), address_id: outerAddr.id, payment_method: "cod", items: [item()] })).estimated_minutes).toBe(45);
    expect(repo._orders).toHaveLength(1);
    expect(mitteAddr.id).toBeDefined();
  });

  it("refuses an address outside the delivery areas and someone else's address", async () => {
    const { svc } = setup();
    const c = await guest(svc);
    const other = await guest(svc);
    const far = await svc.createAddress(c, { ...home, postal_code: "50667" });
    expect((await fail(svc.checkout(c, { idempotency_key: key(5), address_id: far.id, payment_method: "cod", items: [item()] }))).code).toBe("NOT_DELIVERED");
    const theirs = await svc.createAddress(other, home);
    expect((await fail(svc.checkout(c, { idempotency_key: key(6), address_id: theirs.id, payment_method: "cod", items: [item()] }))).code).toBe("ADDRESS_NOT_FOUND");
  });

  it("a retry with the same key returns the same order and places nothing new", async () => {
    const { svc, repo } = setup();
    const c = await guest(svc);
    const a = await svc.createAddress(c, home);
    const req = { idempotency_key: key(7), address_id: a.id, payment_method: "cod" as const, items: [item()] };
    const first = await svc.checkout(c, req);
    const second = await svc.checkout(c, req);
    expect(second.id).toBe(first.id);
    expect(repo._orders).toHaveLength(1);
  });

  it("a retry still returns the order after the menu changed (the item was removed)", async () => {
    const { svc, menu } = setup();
    const c = await guest(svc);
    const a = await svc.createAddress(c, home);
    const req = { idempotency_key: key(8), address_id: a.id, payment_method: "cod" as const, items: [item()] };
    const first = await svc.checkout(c, req);
    menu.removed = true;
    expect((await svc.checkout(c, req)).id).toBe(first.id);
    expect((await fail(svc.checkout(c, { ...req, idempotency_key: key(88) }))).code).toBe("ITEM_UNAVAILABLE"); // but a new order cannot be placed
  });

  it("the same key for a different cart is a conflict, not an unrelated order", async () => {
    const { svc } = setup();
    const c = await guest(svc);
    const a = await svc.createAddress(c, home);
    await svc.checkout(c, { idempotency_key: key(9), address_id: a.id, payment_method: "cod", items: [item()] });
    const err = await fail(svc.checkout(c, { idempotency_key: key(9), address_id: a.id, payment_method: "cod", items: [item({ quantity: 3 })] }));
    expect(err).toMatchObject({ code: "IDEMPOTENCY_CONFLICT", status: 409 });
  });

  it("the same key from two customers makes two orders", async () => {
    const { svc, repo } = setup();
    const c1 = await guest(svc), c2 = await guest(svc);
    const a1 = await svc.createAddress(c1, home), a2 = await svc.createAddress(c2, home);
    await svc.checkout(c1, { idempotency_key: key(10), address_id: a1.id, payment_method: "cod", items: [item()] });
    await svc.checkout(c2, { idempotency_key: key(10), address_id: a2.id, payment_method: "cod", items: [item()] });
    expect(repo._orders).toHaveLength(2);
  });

  it("customers see only their own orders", async () => {
    const { svc } = setup();
    const c1 = await guest(svc), c2 = await guest(svc);
    const a1 = await svc.createAddress(c1, home);
    const order = await svc.checkout(c1, { idempotency_key: key(11), address_id: a1.id, payment_method: "cod", items: [item()] });
    expect((await svc.listOrders(c1)).items).toHaveLength(1);
    expect((await svc.listOrders(c2)).items).toHaveLength(0);
    expect((await svc.getOrder(c1, order.id)).number).toBe("CC-1050");
    expect((await fail(svc.getOrder(c2, order.id))).code).toBe("ORDER_NOT_FOUND");
  });

  it("builds the order the app reads from stored rows only", async () => {
    const { svc, repo } = setup();
    const c = await guest(svc);
    const a = await svc.createAddress(c, home);
    await svc.checkout(c, { idempotency_key: key(12), address_id: a.id, payment_method: "cod", items: [item()] });
    const dto = toOrderDto(repo._orders[0]);
    expect(dto.history).toEqual([{ status: "placed", at: "2026-10-20T12:00:00Z", reason: null, actor: "system" }]);
    expect(dto.tax_minor).toBe(0);
  });
});

describe("launch rules", () => {
  const key = (n: number) => `launch-${String(n).padStart(6, "0")}`;
  async function ready() {
    const ctx = setup();
    const c = await guest(ctx.svc);
    const a = await ctx.svc.createAddress(c, home);
    const place = (over: Record<string, unknown> = {}, n = 1) =>
      ctx.svc.checkout(c, { idempotency_key: key(n), address_id: a.id, payment_method: "cod", items: [item()], ...over } as never);
    return { ...ctx, c, a, place };
  }

  it("refuses an order while the restaurant is closed, with its own message, and places nothing", async () => {
    const { restaurant, place, repo } = await ready();
    restaurant.status = { ...OPEN, open: false, reason: "switched_off", message: "Back at 18:00" };
    const e = await fail(place());
    expect(e).toMatchObject({ status: 409, code: "RESTAURANT_CLOSED", message: "Back at 18:00" });
    expect(repo._orders).toHaveLength(0);
  });

  it("still returns an order placed before closing when the same request is retried", async () => {
    const { restaurant, place } = await ready();
    const first = await place();
    restaurant.status = { ...OPEN, open: false, reason: "switched_off", message: "closed" };
    expect((await place()).id).toBe(first.id);
  });

  it("refuses a blocked customer, but a retry of an earlier order still works", async () => {
    const { c, place, repo } = await ready();
    const first = await place({}, 1);
    c.isBlocked = true;
    expect((await fail(place({}, 2))).code).toBe("CUSTOMER_BLOCKED");
    expect((await place({}, 1)).id).toBe(first.id);
    expect(repo._orders).toHaveLength(1);
  });

  it("stores the name and phone on the order, and remembers them for next time", async () => {
    const { place, repo } = await ready();
    const order = await place({ contact_name: "  Max Muster ", contact_phone: "+49 281 123456" });
    expect(order.contact).toEqual({ name: "Max Muster", phone: "+49 281 123456" });
    expect([...repo._customers.values()][0]).toMatchObject({ fullName: "Max Muster", phone: "+49 281 123456" });
  });

  it("an order without contact details is fine until the restaurant requires them", async () => {
    const { restaurant, place } = await ready();
    expect((await place({}, 1)).contact).toEqual({ name: null, phone: null });
    restaurant.status = { ...OPEN, requireContactDetails: true };
    expect((await fail(place({}, 2))).code).toBe("CONTACT_REQUIRED");
    expect((await place({ contact_name: "Max", contact_phone: "0281 123456" }, 3)).contact.name).toBe("Max");
  });

  it("uses the contact details given earlier when the rule is on and the app sends none", async () => {
    const { restaurant, place } = await ready();
    await place({ contact_name: "Max", contact_phone: "0281 123456" }, 1);
    restaurant.status = { ...OPEN, requireContactDetails: true };
    expect((await place({}, 2)).contact).toEqual({ name: "Max", phone: "0281 123456" });
  });

  it("adds the kitchen's extra minutes to the estimate, in the quote and on the order", async () => {
    const { restaurant, place, svc, c, a } = await ready();
    restaurant.status = { ...OPEN, extraPrepMinutes: 15 };
    expect((await svc.quote(c, { items: [item()], address_id: a.id })).delivery.estimated_minutes).toBe(50);
    expect((await place()).estimated_minutes).toBe(50);
  });

  it("tells the cart whether the restaurant is open", async () => {
    const { restaurant, svc, c } = await ready();
    restaurant.status = { ...OPEN, open: false, reason: "outside_hours", message: "Closed until 11:00" };
    expect((await svc.quote(c, { items: [item()] })).restaurant).toEqual({ open: false, message: "Closed until 11:00", require_contact_details: false });
  });
});
