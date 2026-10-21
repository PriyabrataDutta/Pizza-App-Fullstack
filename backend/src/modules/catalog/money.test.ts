import { describe, expect, it } from "vitest";
import { centsToInput, formatEuro, parseEuro, priceRange } from "./money";

describe("euro formatting", () => {
  it("shows cents the German way", () => {
    expect(formatEuro(750)).toBe("7,50 €");
    expect(formatEuro(5)).toBe("0,05 €");
    expect(formatEuro(129950)).toBe("1.299,50 €");
    expect(centsToInput(750)).toBe("7,50");
    expect(centsToInput(5)).toBe("0,05");
    expect(centsToInput(0)).toBe("0,00");
  });

  it("labels a price range", () => {
    expect(priceRange([])).toBe("No price");
    expect(priceRange([750])).toBe("7,50 €");
    expect(priceRange([900, 700, 1900])).toBe("ab 7,00 €");
    expect(priceRange([500, 500])).toBe("5,00 €");
  });
});

describe("reading typed amounts", () => {
  it("accepts comma or dot decimals and whole euros", () => {
    expect(parseEuro("7,50")).toBe(750);
    expect(parseEuro("7.50")).toBe(750);
    expect(parseEuro("7")).toBe(700);
    expect(parseEuro("7,5")).toBe(750);
    expect(parseEuro("0,05")).toBe(5);
    expect(parseEuro("0")).toBe(0);
    expect(parseEuro(" € 12,00 ")).toBe(1200);
  });

  it("understands thousands separators only when it is clear", () => {
    expect(parseEuro("1.299,50")).toBe(129950);
    expect(parseEuro("1,299.50")).toBe(129950);
    expect(parseEuro("1.299.000")).toBe(129900000);
  });

  it("refuses ambiguous input instead of guessing a price", () => {
    expect(parseEuro("7,555")).toBeNull();
    expect(parseEuro("1.299")).toBeNull();
    expect(parseEuro("7,5555")).toBeNull();
    expect(parseEuro("7.5.5")).toBeNull();
    expect(parseEuro("7,")).toBeNull();
    expect(parseEuro(",5")).toBeNull();
    expect(parseEuro("12.34,5")).toBeNull();
  });

  it("refuses empty, negative and non-numeric input", () => {
    expect(parseEuro("")).toBeNull();
    expect(parseEuro("  ")).toBeNull();
    expect(parseEuro("-1")).toBeNull();
    expect(parseEuro("abc")).toBeNull();
    expect(parseEuro("7,5a")).toBeNull();
    expect(parseEuro("123456789")).toBeNull();
  });

  it("round-trips what it shows", () => {
    for (const cents of [0, 5, 50, 100, 750, 1999, 129950]) expect(parseEuro(centsToInput(cents))).toBe(cents);
  });
});
