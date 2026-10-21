import { describe, expect, it } from "vitest";
import { checkPortions, keyFromLabel, rowsFromPortions, rowsFromTemplate } from "./portion-logic";

describe("size keys", () => {
  it("are made from the label and stay lowercase letters, digits and underscores", () => {
    expect(keyFromLabel("Klein 28 cm", new Set())).toBe("klein_28_cm");
    expect(keyFromLabel("Groß", new Set())).toBe("gross");
    expect(keyFromLabel("0,33 l", new Set())).toBe("0_33_l");
    expect(keyFromLabel("???", new Set())).toBe("size");
  });

  it("get a number when taken", () => {
    expect(keyFromLabel("Klein", new Set(["klein"]))).toBe("klein_2");
    expect(keyFromLabel("Klein", new Set(["klein", "klein_2"]))).toBe("klein_3");
  });
});

describe("sizes table", () => {
  const ok = (price: string, label = "Klein") => [{ key: null, label, price, available: true }];

  it("turns typed rows into what the API stores, in cents", () => {
    const { payload, errors } = checkPortions([...ok("5,50"), { key: "gross", label: "Groß", price: "7.50", available: false }]);
    expect(errors).toEqual({});
    expect(payload).toEqual([
      { key: "klein", label: "Klein", price_minor: 550, is_available: true },
      { key: "gross", label: "Groß", price_minor: 750, is_available: false },
    ]);
  });

  it("keeps the key of a saved size even when its label is changed", () => {
    const { payload } = checkPortions([{ key: "klein", label: "Small", price: "5,50", available: true }]);
    expect(payload[0].key).toBe("klein");
  });

  it("does not reuse the key of an existing size for a new one", () => {
    const { payload } = checkPortions([{ key: "klein", label: "Klein", price: "5", available: true }, { key: null, label: "Klein ", price: "6", available: true }]);
    expect(payload).toEqual([]); // same name: refused
    const second = checkPortions([{ key: "klein", label: "Small", price: "5", available: true }, { key: null, label: "Klein", price: "6", available: true }]);
    expect(second.payload.map((p) => p.key)).toEqual(["klein", "klein_2"]);
  });

  it("refuses a missing name, a bad price, duplicate names and an empty table, and returns nothing to save", () => {
    expect(checkPortions([{ key: null, label: " ", price: "5", available: true }]).errors[0]).toBe("Name this size.");
    expect(checkPortions(ok("abc")).errors[0]).toBe("Enter a price like 7,50.");
    expect(checkPortions(ok("")).errors[0]).toBe("Enter a price like 7,50.");
    expect(checkPortions([...ok("5"), ...ok("6")]).errors[1]).toBe("Two sizes have the same name.");
    expect(checkPortions([]).errors[-1]).toContain("at least one size");
    expect(checkPortions(ok("abc")).payload).toEqual([]);
  });

  it("items made from a template keep the template's keys, so they inherit prices set on the category", () => {
    const { payload } = checkPortions(rowsFromTemplate([{ key: "klein", label: "Klein 28 cm" }, { key: "gross", label: "Groß 32 cm" }]).map((r) => ({ ...r, price: "5" })));
    expect(payload.map((p) => p.key)).toEqual(["klein", "gross"]);
  });

  it("starts from a template with empty prices, or from saved sizes", () => {
    expect(rowsFromTemplate([{ key: "klein", label: "Klein 28 cm" }])).toEqual([{ key: "klein", label: "Klein 28 cm", price: "", available: true }]);
    expect(rowsFromPortions([{ key: "klein", label: "Klein", price_minor: 550, is_available: true }])[0].price).toBe("5,50");
  });
});
