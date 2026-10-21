import { describe, expect, it } from "vitest";
import { cellKey, cellsFromRows, collectRows, columnsFor, fillColumn, type GridColumn } from "./price-grid-logic";

const columns: GridColumn[] = [
  { key: "klein", label: "Klein" },
  { key: "gross", label: "Groß" },
  { key: null, label: "Any size" },
];

describe("price grid", () => {
  it("shows stored prices as typed text", () => {
    const cells = cellsFromRows([{ option_id: "o1", portion_key: "klein", price_minor: 50 }, { option_id: "o1", portion_key: null, price_minor: 250 }]);
    expect(cells[cellKey("o1", "klein")]).toBe("0,50");
    expect(cells[cellKey("o1", null)]).toBe("2,50");
  });

  it("collects only the filled cells", () => {
    const { rows, errors } = collectRows({ [cellKey("o1", "klein")]: "0,50", [cellKey("o1", "gross")]: "  ", [cellKey("o2", null)]: "2" }, ["o1", "o2"], columns);
    expect(errors).toEqual({});
    expect(rows).toEqual([
      { option_id: "o1", portion_key: "klein", price_minor: 50 },
      { option_id: "o2", portion_key: null, price_minor: 200 },
    ]);
  });

  it("reports every cell that is not a clear amount and the caller must not save", () => {
    const { rows, errors } = collectRows({ [cellKey("o1", "klein")]: "abc", [cellKey("o1", "gross")]: "1,555", [cellKey("o2", "klein")]: "1,00" }, ["o1", "o2"], columns);
    expect(Object.keys(errors).sort()).toEqual([cellKey("o1", "gross"), cellKey("o1", "klein")].sort());
    expect(rows).toHaveLength(1);
  });

  it("ignores cells of options that are no longer in the group", () => {
    const { rows } = collectRows({ [cellKey("gone", "klein")]: "1,00" }, ["o1"], columns);
    expect(rows).toEqual([]);
  });

  it("fills a whole column at once", () => {
    const next = fillColumn({ [cellKey("o1", "klein")]: "9" }, ["o1", "o2"], columns[0], "0,50");
    expect(next[cellKey("o1", "klein")]).toBe("0,50");
    expect(next[cellKey("o2", "klein")]).toBe("0,50");
  });

  it("lists the sizes, any size last, and keeps a column for a stored price of a size that is gone", () => {
    const sizes = [{ key: "klein", label: "Klein" }, { key: "gross", label: "Groß" }];
    expect(columnsFor(sizes, []).map((c) => c.key)).toEqual(["klein", "gross", null]);
    const withOld = columnsFor(sizes, [{ option_id: "o1", portion_key: "maxi", price_minor: 250 }, { option_id: "o1", portion_key: "klein", price_minor: 50 }]);
    expect(withOld.map((c) => c.key)).toEqual(["klein", "gross", "maxi", null]);
    expect(withOld[2].label).toContain("no longer a size");
  });
});
