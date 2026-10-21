// Euro amounts for the menu screens. Stored as whole cents; shown and typed the German way ("7,50"). No floating-point math on money:
// typed text is turned into cents by reading the digits, never by multiplying a decimal.

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

/** 750 becomes "7,50 €". */
export function formatEuro(cents: number): string {
  return euro.format(cents / 100).replace(/ /g, " ");
}

/** 750 becomes "7,50", for filling an input. */
export function centsToInput(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Reads what a person typed: "7,50", "7.50", "7", "7,5", "1.299,50", "€ 7,50". Returns whole cents, or null when it is not a clear,
 * valid amount. Anything ambiguous is refused rather than guessed, because a wrong guess becomes a wrong price: "7,555" or "1.299"
 * (is that 1,299 euros or 1.299?) must be typed without grouping. With both "." and "," the last one is the decimal mark.
 */
export function parseEuro(input: string): number | null {
  const text = input.replace(/[€\s ]/g, "");
  if (text === "" || !/^[0-9.,]+$/.test(text) || /^[.,]|[.,]$/.test(text)) return null;

  let whole: string;
  let fraction = "";
  const hasDot = text.includes(".");
  const hasComma = text.includes(",");
  if (hasDot && hasComma) {
    const decimalMark = text.lastIndexOf(".") > text.lastIndexOf(",") ? "." : ",";
    const groupMark = decimalMark === "." ? "," : ".";
    const at = text.lastIndexOf(decimalMark);
    const head = text.slice(0, at);
    if (head.includes(decimalMark)) return null;
    const groups = head.split(groupMark);
    if (groups[0].length < 1 || groups[0].length > 3 || groups.slice(1).some((g) => g.length !== 3)) return null;
    whole = groups.join("");
    fraction = text.slice(at + 1);
  } else if (hasDot || hasComma) {
    const mark = hasDot ? "." : ",";
    const parts = text.split(mark);
    if (parts.length === 2) {
      if (parts[1].length === 3) return null; // "7,555" or "1.299": thousands or a typo, refuse
      whole = parts[0];
      fraction = parts[1];
    } else {
      if (parts[0].length < 1 || parts[0].length > 3 || parts.slice(1).some((g) => g.length !== 3)) return null;
      whole = parts.join("");
    }
  } else {
    whole = text;
  }
  if (!/^[0-9]+$/.test(whole) || !/^[0-9]{0,2}$/.test(fraction) || whole.length > 8) return null;
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0") || "0");
}

/** A short price label for a list: "5,50 €" for one price, "ab 5,50 €" for several. */
export function priceRange(prices: number[]): string {
  if (prices.length === 0) return "No price";
  const min = Math.min(...prices);
  return prices.length === 1 || Math.max(...prices) === min ? formatEuro(min) : `ab ${formatEuro(min)}`;
}
