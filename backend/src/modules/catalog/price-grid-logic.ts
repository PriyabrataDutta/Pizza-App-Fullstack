import { centsToInput, parseEuro } from "./money";

// The price grid sets what each extra costs on each size, for one place the group applies (a category or a single item).
// Cells are typed text; an empty cell means "no price here", so the next place in the lookup order decides
// (item, then category, then the option's own price). These helpers turn cells into the rows the API stores, and back.

export interface GridColumn {
  /** The size key ("klein"), or null for "any size", the fallback used when a size has no price of its own. */
  key: string | null;
  label: string;
}

export interface PriceRow {
  option_id: string;
  portion_key: string | null;
  price_minor: number;
}

export const cellKey = (optionId: string, portionKey: string | null) => `${optionId}|${portionKey ?? "*"}`;

/** Typed text for every stored price. */
export function cellsFromRows(rows: PriceRow[]): Record<string, string> {
  return Object.fromEntries(rows.map((r) => [cellKey(r.option_id, r.portion_key), centsToInput(r.price_minor)]));
}

export interface Collected {
  rows: PriceRow[];
  /** Cell key to message, for every cell that is not a valid amount. */
  errors: Record<string, string>;
}

/** Reads the grid. Empty cells are left out; a cell that is not a clear amount is reported, and nothing should be saved until none are. */
export function collectRows(cells: Record<string, string>, optionIds: string[], columns: GridColumn[]): Collected {
  const rows: PriceRow[] = [];
  const errors: Record<string, string> = {};
  for (const optionId of optionIds) {
    for (const column of columns) {
      const key = cellKey(optionId, column.key);
      const text = (cells[key] ?? "").trim();
      if (text === "") continue;
      const cents = parseEuro(text);
      if (cents === null) errors[key] = "Enter an amount like 1,00";
      else rows.push({ option_id: optionId, portion_key: column.key, price_minor: cents });
    }
  }
  return { rows, errors };
}

/** Puts the same text in one column for every option ("Set all"). */
export function fillColumn(cells: Record<string, string>, optionIds: string[], column: GridColumn, text: string): Record<string, string> {
  const next = { ...cells };
  for (const optionId of optionIds) next[cellKey(optionId, column.key)] = text;
  return next;
}

/**
 * The columns to show for an item or category: its sizes, then "any size". Stored rows for a size that no longer exists are kept
 * visible as their own column, so saving never silently drops a price.
 */
export function columnsFor(sizes: { key: string; label: string }[], storedRows: PriceRow[]): GridColumn[] {
  const columns: GridColumn[] = sizes.map((s) => ({ key: s.key, label: s.label }));
  for (const row of storedRows) {
    if (row.portion_key !== null && !columns.some((c) => c.key === row.portion_key)) {
      columns.push({ key: row.portion_key, label: `${row.portion_key} (no longer a size)` });
    }
  }
  columns.push({ key: null, label: "Any size" });
  return columns;
}
