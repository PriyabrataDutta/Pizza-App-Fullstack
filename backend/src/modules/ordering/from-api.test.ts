import { describe, expect, it } from "vitest";
import type { OrderAdmin } from "@/modules/catalog/admin-client";
import { fromAdminOrder } from "./from-api";

const api = (over: Partial<OrderAdmin> = {}): OrderAdmin => ({
  id: "o1", number: "CC-1060", status: "placed", total_minor: 2050, currency: "EUR", created_at: "2026-10-21T16:24:00Z",
  subtotal_minor: 2550, discount_minor: 500, tax_minor: 0, delivery_fee_minor: 0, coupon_code: "WELCOME5",
  payment_method: "cod", payment_status: "pending", estimated_minutes: 35,
  delivery_address: "Hohe Straße 12, Wesel-Mitte, 46483 Wesel",
  delivery: { label: "Home", line1: "Hohe Straße 12", locality: "Wesel-Mitte", city: "Wesel", postal_code: "46483", instructions: "Ring twice" },
  lines: [{ name: "Margherita", portion: "Groß 32 cm", options: ["Champignons"], quantity: 3, unit_price_minor: 850, line_total_minor: 2550 }],
  history: [{ status: "placed", at: "2026-10-21T16:24:00Z", reason: null, actor: "system" }],
  ...over,
});

describe("fromAdminOrder", () => {
  it("maps the order for the board and the drawer", () => {
    const o = fromAdminOrder(api());
    expect(o.number).toBe("CC-1060");
    expect(o.status).toBe("placed");
    expect(o.totalMinor).toBe(2050);
    expect(o.discountMinor).toBe(500);
    expect(o.couponCode).toBe("WELCOME5");
    expect(o.address).toBe("Hohe Straße 12, Wesel-Mitte, 46483 Wesel");
    expect(o.instructions).toBe("Ring twice");
    expect(o.lines).toEqual([{ name: "Margherita", variant: "Groß 32 cm", options: ["Champignons"], quantity: 3, lineTotalMinor: 2550 }]);
    expect(o.history).toEqual([{ status: "placed", at: "2026-10-21T16:24:00Z", actor: "system", reason: undefined }]);
  });

  it("identifies a guest by the street, with no phone", () => {
    const o = fromAdminOrder(api());
    expect(o.customerName).toBe("Guest · Hohe Straße 12");
    expect(o.customerPhone).toBe("");
  });

  it("maps payment: cash pending, demo online paid", () => {
    expect(fromAdminOrder(api()).paymentMethod).toBe("cod");
    const online = fromAdminOrder(api({ payment_method: "online_demo", payment_status: "demo_paid" }));
    expect(online.paymentMethod).toBe("online_demo");
    expect(online.paymentStatus).toBe("paid");
  });

  it("has no note or coupon when there is none", () => {
    const o = fromAdminOrder(api({ coupon_code: null, delivery: { label: "Home", line1: "x", locality: "y", city: "z", postal_code: "46483", instructions: null } }));
    expect(o.couponCode).toBeUndefined();
    expect(o.instructions).toBeUndefined();
  });

  it("does not crash on a status it does not know", () => {
    expect(fromAdminOrder(api({ status: "teleporting" })).status).toBe("placed");
  });
});
