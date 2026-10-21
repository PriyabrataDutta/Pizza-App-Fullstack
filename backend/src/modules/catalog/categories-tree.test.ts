import { describe, expect, it } from "vitest";
import { applyOrder, buildRows, dropOnto, moveId, sameOrder, siblingIds, type TreeCategory } from "./categories-tree";

const c = (id: string, sort: number, parent: string | null = null, active = true): TreeCategory => ({ id, parent_id: parent, sort_order: sort, name: id, is_active: active });

describe("category tree", () => {
  const list = [c("b", 2), c("a", 1), c("a2", 2, "a"), c("a1", 1, "a"), c("z", 3, null, false), c("z1", 1, "z")];

  it("puts each sub-category right after its parent, both in order", () => {
    expect(buildRows(list).map((r) => [r.category.id, r.depth])).toEqual([
      ["a", 0], ["a1", 1], ["a2", 1], ["b", 0], ["z", 0], ["z1", 1],
    ]);
  });

  it("flags sub-categories kept out of the app by a hidden parent", () => {
    const rows = buildRows(list);
    expect(rows.find((r) => r.category.id === "z1")!.hiddenByParent).toBe(true);
    expect(rows.find((r) => r.category.id === "a1")!.hiddenByParent).toBe(false);
  });

  it("shows an orphan at the top level instead of losing it", () => {
    expect(buildRows([c("x", 1, "gone")]).map((r) => [r.category.id, r.depth])).toEqual([["x", 0]]);
  });

  it("finds siblings in order", () => {
    expect(siblingIds(list, null)).toEqual(["a", "b", "z"]);
    expect(siblingIds(list, "a")).toEqual(["a1", "a2"]);
  });
});

describe("reordering", () => {
  it("moves one step and stops at the edges", () => {
    expect(moveId(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(moveId(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moveId(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
    expect(moveId(["a", "b"], "missing", 1)).toEqual(["a", "b"]);
  });

  it("drops an item onto another, in either direction", () => {
    expect(dropOnto(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
    expect(dropOnto(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "c", "a", "d"]);
    expect(dropOnto(["a", "b"], "a", "a")).toEqual(["a", "b"]);
    expect(dropOnto(["a", "b"], "a", "missing")).toEqual(["a", "b"]);
  });

  it("renumbers only the categories that were reordered", () => {
    const next = applyOrder([c("a", 1), c("b", 2), c("c", 3), c("x", 9, "a")], ["c", "a", "b"]);
    expect(next.map((x) => [x.id, x.sort_order])).toEqual([["a", 2], ["b", 3], ["c", 1], ["x", 9]]);
  });

  it("compares orders", () => {
    expect(sameOrder(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameOrder(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameOrder(["a"], ["a", "b"])).toBe(false);
  });
});
