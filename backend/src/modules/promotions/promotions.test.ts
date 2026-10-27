import { describe, expect, it } from "vitest";
import { isLive, stateOf, toPublic, type PromotionRow } from "./domain";
import { promotionCreate, promotionUpdate } from "./schemas";

const row = (over: Partial<PromotionRow> = {}): PromotionRow => ({
  id: "p1", title: "Angebot 1 · 25 €", detail: "2 große Pizzen", coupon_code: null, image_path: null, sort_order: 1, is_active: true,
  starts_at: null, ends_at: null, created_at: "2026-10-27T10:00:00Z", ...over,
});
const now = new Date("2026-10-27T12:00:00Z");
const url = (p: string | null) => (p ? `https://cdn.example/${p}` : null);

describe("which banners are showing", () => {
  it("a banner with no dates shows while it is switched on", () => {
    expect(isLive(row(), now)).toBe(true);
    expect(isLive(row({ is_active: false }), now)).toBe(false);
  });

  it("waits for its start and stops at its end, on the second", () => {
    expect(isLive(row({ starts_at: "2026-10-27T12:00:01Z" }), now)).toBe(false);
    expect(isLive(row({ starts_at: "2026-10-27T12:00:00Z" }), now)).toBe(true);
    expect(isLive(row({ ends_at: "2026-10-27T12:00:00Z" }), now)).toBe(false);
    expect(isLive(row({ ends_at: "2026-10-27T12:00:01Z" }), now)).toBe(true);
  });

  it("says where each banner stands, for the dashboard", () => {
    expect(stateOf(row(), now)).toBe("showing");
    expect(stateOf(row({ is_active: false }), now)).toBe("hidden");
    expect(stateOf(row({ starts_at: "2026-11-01T00:00:00Z" }), now)).toBe("scheduled");
    expect(stateOf(row({ ends_at: "2026-10-01T00:00:00Z" }), now)).toBe("ended");
  });
});

describe("what the app receives", () => {
  it("only live banners, in the restaurant's order, with the picture address and the code", () => {
    const rows = [
      row({ id: "c", sort_order: 3, title: "C" }),
      row({ id: "a", sort_order: 1, title: "A", image_path: "promotions/a.webp", coupon_code: "WELCOME5" }),
      row({ id: "x", sort_order: 2, title: "hidden", is_active: false }),
      row({ id: "e", sort_order: 2, title: "ended", ends_at: "2026-10-01T00:00:00Z" }),
    ];
    expect(toPublic(rows, now, url)).toEqual([
      { id: "a", title: "A", detail: "2 große Pizzen", code: "WELCOME5", image_url: "https://cdn.example/promotions/a.webp" },
      { id: "c", title: "C", detail: "2 große Pizzen", code: null, image_url: null },
    ]);
  });

  it("is an empty list, not an error, when nothing is showing", () => {
    expect(toPublic([], now, url)).toEqual([]);
  });

  it("does not expose when or by whom a banner was scheduled", () => {
    const [p] = toPublic([row({ starts_at: "2026-10-01T00:00:00Z" })], now, url);
    expect(Object.keys(p).sort()).toEqual(["code", "detail", "id", "image_url", "title"]);
  });
});

describe("banner requests", () => {
  it("a new banner needs only a headline", () => {
    const r = promotionCreate.parse({ title: "  Pizza-Tag  " });
    expect(r).toMatchObject({ title: "Pizza-Tag", detail: "", coupon_code: null, image_path: null, is_active: true, starts_at: null, ends_at: null });
  });

  it("limits the lengths and checks the code", () => {
    expect(promotionCreate.safeParse({ title: "" }).success).toBe(false);
    expect(promotionCreate.safeParse({ title: "x".repeat(81) }).success).toBe(false);
    expect(promotionCreate.safeParse({ title: "T", detail: "x".repeat(201) }).success).toBe(false);
    expect(promotionCreate.parse({ title: "T", coupon_code: " welcome5 " }).coupon_code).toBe("WELCOME5");
    expect(promotionCreate.safeParse({ title: "T", coupon_code: "no spaces" }).success).toBe(false);
  });

  it("the end must be after the start", () => {
    expect(promotionCreate.safeParse({ title: "T", starts_at: "2026-11-02T00:00:00Z", ends_at: "2026-11-01T00:00:00Z" }).success).toBe(false);
    expect(promotionCreate.safeParse({ title: "T", starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-11-02T00:00:00Z" }).success).toBe(true);
    expect(promotionCreate.safeParse({ title: "T", starts_at: "not a date" }).success).toBe(false);
  });

  it("only picture paths inside the bucket are accepted", () => {
    expect(promotionCreate.safeParse({ title: "T", image_path: "promotions/abc.webp" }).success).toBe(true);
    expect(promotionCreate.safeParse({ title: "T", image_path: "../secrets" }).success).toBe(false);
    expect(promotionCreate.safeParse({ title: "T", image_path: "https://evil.example/x.png" }).success).toBe(false);
  });

  it("an update changes only what it was given, and not nothing", () => {
    expect(promotionUpdate.parse({ is_active: false })).toEqual({ is_active: false });
    expect(promotionUpdate.safeParse({}).success).toBe(false);
  });
});
