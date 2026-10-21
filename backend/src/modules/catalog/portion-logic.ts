import { centsToInput, parseEuro } from "./money";
import { slugify } from "./admin/slug";

// The sizes table of the product editor. A size has a label people read ("Klein 28 cm") and a key the system matches prices on
// ("klein_28_cm"). The key is made from the label when a size is added and then never changes, because extra prices, carts and
// orders refer to it.

export interface PortionRowState {
  /** Null for a size that has not been saved yet. */
  key: string | null;
  label: string;
  /** Typed price in euros. */
  price: string;
  available: boolean;
}

export interface PortionPayload {
  key: string;
  label: string;
  price_minor: number;
  is_available: boolean;
}

/** "Klein 28 cm" becomes "klein_28_cm". Keys already in use get a number added. */
export function keyFromLabel(label: string, taken: ReadonlySet<string>): string {
  const base = slugify(label).replace(/-/g, "_").slice(0, 28) || "size";
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    if (!taken.has(`${base}_${n}`)) return `${base}_${n}`;
  }
  return `${base}_${Date.now() % 100000}`;
}

export function rowsFromPortions(portions: { key: string; label: string; price_minor: number; is_available: boolean }[]): PortionRowState[] {
  return portions.map((p) => ({ key: p.key, label: p.label, price: centsToInput(p.price_minor), available: p.is_available }));
}

/**
 * Empty rows (no price yet) for the sizes of a template, so only the prices are left to type. They keep the template's own keys
 * ("klein", "gross"), not keys made from the labels: prices set on the category are matched by key, so every item made from the
 * template must use the same ones to inherit them.
 */
export function rowsFromTemplate(items: { key: string; label: string }[]): PortionRowState[] {
  return items.map((i) => ({ key: i.key, label: i.label, price: "", available: true }));
}

export interface PortionCheck {
  payload: PortionPayload[];
  /** Row index to message. Row `-1` is a message about the table as a whole. */
  errors: Record<number, string>;
}

export function checkPortions(rows: PortionRowState[]): PortionCheck {
  const errors: Record<number, string> = {};
  const payload: PortionPayload[] = [];
  if (rows.length === 0) errors[-1] = "Add at least one size, even if the item only comes in one.";
  const taken = new Set(rows.filter((r) => r.key).map((r) => r.key as string));
  const labels = new Set<string>();
  rows.forEach((row, i) => {
    const label = row.label.trim();
    if (!label) return void (errors[i] = "Name this size.");
    if (labels.has(label.toLowerCase())) return void (errors[i] = "Two sizes have the same name.");
    labels.add(label.toLowerCase());
    const cents = parseEuro(row.price);
    if (cents === null) return void (errors[i] = "Enter a price like 7,50.");
    const key = row.key ?? keyFromLabel(label, taken);
    taken.add(key);
    payload.push({ key, label, price_minor: cents, is_available: row.available });
  });
  return { payload: Object.keys(errors).length === 0 ? payload : [], errors };
}
