"use client";

import { useMemo, useState } from "react";
import { Button, inputCls } from "@/shared/ui";
import { formatEuro } from "./money";
import { cellKey, cellsFromRows, collectRows, fillColumn, type GridColumn, type PriceRow } from "./price-grid-logic";

interface GridOption {
  id: string;
  name: string;
  default_price_minor: number;
  is_active: boolean;
}

/**
 * Sets what each extra costs on each size. One row per option, one column per size, plus "Any size" as the fallback.
 * An empty cell means "no price here": the next place decides (this item, then its category, then the option's own price),
 * and the greyed hint in the cell shows what would apply.
 */
export function PriceGrid({ options, columns, initial, inherited, onSave, onCancel, saveLabel = "Save prices" }: {
  options: GridOption[];
  columns: GridColumn[];
  initial: PriceRow[];
  /** Prices from the next place in the lookup order (the category, when editing an item), shown as hints. */
  inherited?: PriceRow[];
  onSave: (rows: PriceRow[]) => Promise<void>;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const [cells, setCells] = useState(() => cellsFromRows(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fill, setFill] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");
  const optionIds = useMemo(() => options.map((o) => o.id), [options]);

  const hint = (option: GridOption, column: GridColumn) => {
    const inheritedRow = inherited?.find((r) => r.option_id === option.id && r.portion_key === column.key)
      ?? (column.key !== null ? inherited?.find((r) => r.option_id === option.id && r.portion_key === null) : undefined);
    if (inheritedRow) return `${formatEuro(inheritedRow.price_minor)} from category`;
    return column.key === null ? `${formatEuro(option.default_price_minor)} (default)` : "";
  };

  async function save() {
    const { rows, errors: found } = collectRows(cells, optionIds, columns);
    setErrors(found);
    if (Object.keys(found).length > 0) return setProblem("Some prices are not clear amounts. Type them like 1,00.");
    setProblem("");
    setSaving(true);
    try {
      await onSave(rows);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Could not save the prices.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="max-h-[55vh] overflow-auto rounded-control border border-line">
        <table className="w-full min-w-[480px] border-collapse text-left text-sm">
          <caption className="sr-only">Price of each extra by size, in euros</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky top-0 z-10 bg-subtle px-3 py-2 text-xs font-medium text-ink-2">Extra</th>
              {columns.map((c) => <th key={String(c.key)} scope="col" className="sticky top-0 z-10 bg-subtle px-2 py-2 text-xs font-medium text-ink-2">{c.label}</th>)}
            </tr>
            <tr>
              <th scope="row" className="sticky top-8 z-10 border-b border-line bg-surface px-3 py-2 text-xs font-medium text-ink-2">Set all to</th>
              {columns.map((c) => (
                <td key={String(c.key)} className="sticky top-8 z-10 border-b border-line bg-surface px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <input
                      aria-label={`Set every extra in ${c.label} to`}
                      inputMode="decimal"
                      value={fill[String(c.key)] ?? ""}
                      onChange={(e) => setFill({ ...fill, [String(c.key)]: e.target.value })}
                      className={`${inputCls} num min-h-9 w-20 px-2`}
                      placeholder="0,00"
                    />
                    <Button type="button" size="sm" variant="secondary" disabled={(fill[String(c.key)] ?? "").trim() === ""} onClick={() => setCells(fillColumn(cells, optionIds, c, (fill[String(c.key)] ?? "").trim()))}>
                      Apply
                    </Button>
                  </div>
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {options.map((o) => (
              <tr key={o.id} className={o.is_active ? "" : "opacity-60"}>
                <th scope="row" className="border-b border-line px-3 py-1.5 text-left font-normal">{o.name}{!o.is_active && <span className="text-xs text-ink-2"> (hidden)</span>}</th>
                {columns.map((c) => {
                  const key = cellKey(o.id, c.key);
                  return (
                    <td key={key} className="border-b border-line px-2 py-1.5">
                      <input
                        aria-label={`${o.name}, ${c.label}`}
                        aria-invalid={errors[key] ? true : undefined}
                        inputMode="decimal"
                        value={cells[key] ?? ""}
                        onChange={(e) => setCells({ ...cells, [key]: e.target.value })}
                        className={`${inputCls} num min-h-9 w-24 px-2 ${errors[key] ? "border-error" : ""}`}
                        placeholder={hint(o, c) ? "" : "–"}
                      />
                      {errors[key] ? <span className="block text-[11px] text-error">{errors[key]}</span> : (cells[key] ?? "") === "" && hint(o, c) ? <span className="block text-[11px] text-ink-2">{hint(o, c)}</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-2">Prices are in euros. Leave a cell empty to use the next price down: the category&apos;s, then the extra&apos;s own price.</p>
      {problem && <p role="alert" className="text-sm text-error">{problem}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" loading={saving} onClick={() => void save()}>{saveLabel}</Button>
        <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
