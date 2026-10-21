import { describe, expect, it } from "vitest";
import { bearerToken, hashToken, newDeviceToken, TOKEN_PREFIX } from "./token";
import { checkCoupon, computeQuote, couponDiscount, zoneForPostcode, type CouponRule, type ZoneRule } from "./quote";

const now = new Date("2026-10-20T12:00:00Z");
const coupon = (over: Partial<CouponRule> = {}): CouponRule => ({
  id: "c1", code: "WELCOME5", discountType: "fixed", discountValue: 500, minimumOrderMinor: 2000, maximumDiscountMinor: null,
  startsAt: null, expiresAt: null, isActive: true, ...over,
});
const mitte: ZoneRule = { id: "z1", name: "Wesel-Mitte", postalCodes: ["46483"], minimumOrderMinor: 1000, deliveryFeeMinor: 0, estimatedMinutes: 35, isActive: true };
const outer: ZoneRule = { id: "z2", name: "Blumenkamp, Schornacker, Flüren", postalCodes: ["46485", "46487"], minimumOrderMinor: 2000, deliveryFeeMinor: 0, estimatedMinutes: 45, isActive: true };
const line = (cents: number) => ({ lineTotalMinor: cents });

describe("device tokens", () => {
  it("are random, prefixed, and stored only as a hash", () => {
    const a = newDeviceToken(), b = newDeviceToken();
    expect(a).not.toBe(b);
    expect(a.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).not.toContain(a.slice(4));
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toBe(hashToken(b));
  });

  it("are read from a Bearer header and nothing else", () => {
    const t = newDeviceToken();
    expect(bearerToken(`Bearer ${t}`)).toBe(t);
    expect(bearerToken(`bearer ${t}`)).toBe(t);
    expect(bearerToken(t)).toBeNull();
    expect(bearerToken("Bearer short")).toBeNull();
    expect(bearerToken("Bearer " + "x".repeat(50))).toBeNull(); // right length, wrong prefix
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("Basic abc")).toBeNull();
  });
});

describe("coupons", () => {
  it("takes a fixed amount, never more than the order", () => {
    expect(couponDiscount(coupon(), 2500)).toBe(500);
    expect(couponDiscount(coupon({ discountValue: 5000 }), 2500)).toBe(2500);
  });

  it("takes a percentage rounded down, and respects the cap", () => {
    const tenPercent = coupon({ discountType: "percentage", discountValue: 10, maximumDiscountMinor: 1000 });
    expect(couponDiscount(tenPercent, 3333)).toBe(333);
    expect(couponDiscount(tenPercent, 20000)).toBe(1000);
  });

  it("explains why a coupon does not work", () => {
    expect(checkCoupon(null, 5000, now)?.code).toBe("COUPON_INVALID");
    expect(checkCoupon(coupon({ isActive: false }), 5000, now)?.code).toBe("COUPON_INVALID");
    expect(checkCoupon(coupon({ expiresAt: new Date("2026-10-19T00:00:00Z") }), 5000, now)?.code).toBe("COUPON_EXPIRED");
    expect(checkCoupon(coupon({ startsAt: new Date("2026-11-01T00:00:00Z") }), 5000, now)?.code).toBe("COUPON_EXPIRED");
    const small = checkCoupon(coupon(), 1700, now);
    expect(small?.code).toBe("COUPON_MINIMUM");
    expect(small?.shortByMinor).toBe(300);
    expect(small?.message).toBe("Add 3,00 € more to use WELCOME5.");
    expect(checkCoupon(coupon(), 2000, now)).toBeNull();
  });
});

describe("delivery areas", () => {
  it("find the area for a postcode, and none for a postcode we do not serve", () => {
    const zones = [mitte, outer];
    expect(zoneForPostcode(zones, "46483")?.name).toBe("Wesel-Mitte");
    expect(zoneForPostcode(zones, "46487")?.minimumOrderMinor).toBe(2000);
    expect(zoneForPostcode(zones, "50667")).toBeNull();
    expect(zoneForPostcode([{ ...mitte, isActive: false }], "46483")).toBeNull();
  });
});

describe("quote", () => {
  it("adds up the lines, and the total is what is charged", () => {
    const r = computeQuote({ lines: [line(900), line(1100)], now });
    expect(r).toMatchObject({ ok: true, quote: { subtotalMinor: 2000, discountMinor: 0, taxMinor: 0, deliveryFeeMinor: 0, totalMinor: 2000, meetsMinimum: true } });
  });

  it("applies a coupon", () => {
    const r = computeQuote({ lines: [line(2500)], coupon: coupon(), couponRequested: true, now });
    expect(r).toMatchObject({ ok: true, quote: { discountMinor: 500, totalMinor: 2000, couponCode: "WELCOME5", couponId: "c1" } });
  });

  it("refuses an empty cart and a coupon that does not qualify", () => {
    expect(computeQuote({ lines: [], now })).toMatchObject({ ok: false, issue: { code: "EMPTY_CART" } });
    expect(computeQuote({ lines: [line(1000)], coupon: coupon(), couponRequested: true, now })).toMatchObject({ ok: false, issue: { code: "COUPON_MINIMUM", shortByMinor: 1000 } });
    expect(computeQuote({ lines: [line(1000)], coupon: null, couponRequested: true, now })).toMatchObject({ ok: false, issue: { code: "COUPON_INVALID" } });
  });

  it("reports the minimum for the area without blocking the cart quote", () => {
    const r = computeQuote({ lines: [line(900)], zone: mitte, now });
    expect(r).toMatchObject({ ok: true, quote: { minimumOrderMinor: 1000, meetsMinimum: false, estimatedMinutes: 35, zoneId: "z1" } });
  });

  it("refuses at checkout an order below the minimum of its area", () => {
    const small = computeQuote({ lines: [line(900)], zone: mitte, requireZone: true, now });
    expect(small).toMatchObject({ ok: false, issue: { code: "MINIMUM_ORDER", shortByMinor: 100 } });
    expect((small as { issue: { message: string } }).issue.message).toContain("Add 1,00 € more");
    expect(computeQuote({ lines: [line(1000)], zone: mitte, requireZone: true, now }).ok).toBe(true);
    expect(computeQuote({ lines: [line(1500)], zone: outer, requireZone: true, now })).toMatchObject({ ok: false, issue: { code: "MINIMUM_ORDER", shortByMinor: 500 } });
    expect(computeQuote({ lines: [line(2000)], zone: outer, requireZone: true, now })).toMatchObject({ ok: true, quote: { estimatedMinutes: 45 } });
  });

  it("judges the minimum on what is ordered, before the discount", () => {
    const r = computeQuote({ lines: [line(2000)], zone: outer, coupon: coupon(), couponRequested: true, requireZone: true, now });
    expect(r).toMatchObject({ ok: true, quote: { subtotalMinor: 2000, discountMinor: 500, totalMinor: 1500 } });
  });

  it("does not deliver outside the areas", () => {
    expect(computeQuote({ lines: [line(5000)], addressOutsideArea: true, now })).toMatchObject({ ok: false, issue: { code: "NOT_DELIVERED" } });
    expect(computeQuote({ lines: [line(5000)], requireZone: true, now })).toMatchObject({ ok: false, issue: { code: "NOT_DELIVERED" } });
  });

  it("adds the area's delivery fee when there is one", () => {
    const r = computeQuote({ lines: [line(2000)], zone: { ...mitte, deliveryFeeMinor: 150 }, now });
    expect(r).toMatchObject({ ok: true, quote: { deliveryFeeMinor: 150, totalMinor: 2150 } });
  });
});
