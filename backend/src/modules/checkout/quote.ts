// The money rules of an order, as pure functions: coupons, delivery areas, the minimum order and the totals.
// Lines are priced elsewhere (modules/catalog/pricing.ts); this adds everything around them. Used for the cart quote and again
// for checkout, so the number a customer sees and the number that is charged cannot drift apart.

export interface PricedLineInput {
  lineTotalMinor: number;
}

export interface CouponRule {
  id: string;
  code: string;
  discountType: "fixed" | "percentage";
  discountValue: number;
  minimumOrderMinor: number;
  maximumDiscountMinor: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
}

export interface ZoneRule {
  id: string;
  name: string;
  postalCodes: string[];
  minimumOrderMinor: number;
  deliveryFeeMinor: number;
  estimatedMinutes: number;
  isActive: boolean;
}

export type QuoteIssueCode = "COUPON_INVALID" | "COUPON_EXPIRED" | "COUPON_MINIMUM" | "NOT_DELIVERED" | "MINIMUM_ORDER" | "EMPTY_CART";

export interface QuoteIssue {
  code: QuoteIssueCode;
  message: string;
  /** For COUPON_MINIMUM and MINIMUM_ORDER: how much more the customer has to order. */
  shortByMinor?: number;
}

export interface Quote {
  subtotalMinor: number;
  discountMinor: number;
  /** Menu prices include VAT, so nothing is added on top. */
  taxMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  couponCode: string | null;
  couponId: string | null;
  zoneId: string | null;
  estimatedMinutes: number | null;
  /** The minimum for the delivery area, when the area is known. */
  minimumOrderMinor: number | null;
  /** True when the order is big enough for the area (or the area is not known yet, so nothing is blocked). */
  meetsMinimum: boolean;
}

export type QuoteResult = { ok: true; quote: Quote } | { ok: false; issue: QuoteIssue };

export const formatCents = (cents: number) => `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")} €`;

/** The area a postcode belongs to, or null when we do not deliver there. */
export function zoneForPostcode(zones: ZoneRule[], postalCode: string): ZoneRule | null {
  return zones.find((z) => z.isActive && z.postalCodes.includes(postalCode)) ?? null;
}

/** Whole cents off the subtotal. A fixed amount never exceeds the subtotal; a percentage rounds down and respects the cap. */
export function couponDiscount(coupon: CouponRule, subtotalMinor: number): number {
  const raw = coupon.discountType === "fixed" ? coupon.discountValue : Math.floor((subtotalMinor * coupon.discountValue) / 100);
  const capped = coupon.maximumDiscountMinor === null ? raw : Math.min(raw, coupon.maximumDiscountMinor);
  return Math.max(0, Math.min(capped, subtotalMinor));
}

/** Whether a coupon may be used now, and why not. Usage limits are enforced by the database at checkout, under a lock. */
export function checkCoupon(coupon: CouponRule | null, subtotalMinor: number, now: Date): QuoteIssue | null {
  if (!coupon || !coupon.isActive) return { code: "COUPON_INVALID", message: "That code isn’t valid. Check it and try again." };
  if ((coupon.startsAt && coupon.startsAt > now) || (coupon.expiresAt && coupon.expiresAt <= now)) return { code: "COUPON_EXPIRED", message: "That offer has ended." };
  if (subtotalMinor < coupon.minimumOrderMinor) {
    const short = coupon.minimumOrderMinor - subtotalMinor;
    return { code: "COUPON_MINIMUM", message: `Add ${formatCents(short)} more to use ${coupon.code}.`, shortByMinor: short };
  }
  return null;
}

/**
 * Totals for a cart. The coupon (if any) is checked and applied, the delivery area (if the address is known) sets the fee and the
 * estimate, and the minimum order is reported either way. `requireZone` is for checkout: the order is then refused when the address is
 * outside the delivery area or the order is too small.
 */
export function computeQuote(input: {
  lines: PricedLineInput[];
  coupon?: CouponRule | null;
  couponRequested?: boolean;
  zone?: ZoneRule | null;
  /** True when an address was given but no area covers its postcode. */
  addressOutsideArea?: boolean;
  requireZone?: boolean;
  now: Date;
}): QuoteResult {
  if (input.lines.length === 0) return { ok: false, issue: { code: "EMPTY_CART", message: "Your cart is empty." } };
  const subtotal = input.lines.reduce((sum, l) => sum + l.lineTotalMinor, 0);

  let discount = 0;
  let couponId: string | null = null;
  let couponCode: string | null = null;
  if (input.couponRequested) {
    const problem = checkCoupon(input.coupon ?? null, subtotal, input.now);
    if (problem) return { ok: false, issue: problem };
    discount = couponDiscount(input.coupon!, subtotal);
    couponId = input.coupon!.id;
    couponCode = input.coupon!.code;
  }

  if (input.addressOutsideArea || (input.requireZone && !input.zone)) {
    return { ok: false, issue: { code: "NOT_DELIVERED", message: "Sorry, we don’t deliver to that postcode yet." } };
  }
  const zone = input.zone ?? null;
  const afterDiscount = subtotal - discount;
  // The minimum is judged on what is ordered, before any discount, like the flyer's "from 10 €".
  const meetsMinimum = zone ? subtotal >= zone.minimumOrderMinor : true;
  if (input.requireZone && zone && !meetsMinimum) {
    const short = zone.minimumOrderMinor - subtotal;
    return { ok: false, issue: { code: "MINIMUM_ORDER", message: `The minimum order for ${zone.name} is ${formatCents(zone.minimumOrderMinor)}. Add ${formatCents(short)} more.`, shortByMinor: short } };
  }
  const deliveryFee = zone ? zone.deliveryFeeMinor : 0;
  return {
    ok: true,
    quote: {
      subtotalMinor: subtotal,
      discountMinor: discount,
      taxMinor: 0,
      deliveryFeeMinor: deliveryFee,
      totalMinor: afterDiscount + deliveryFee,
      couponCode,
      couponId,
      zoneId: zone?.id ?? null,
      estimatedMinutes: zone?.estimatedMinutes ?? null,
      minimumOrderMinor: zone?.minimumOrderMinor ?? null,
      meetsMinimum,
    },
  };
}
