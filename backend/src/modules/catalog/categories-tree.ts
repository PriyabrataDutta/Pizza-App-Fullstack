// Pure helpers for the Categories screen: arranging the flat list into parents and sub-categories, and reordering siblings.
// No React and no network, so the rules are easy to test.

export interface TreeCategory {
  id: string;
  parent_id: string | null;
  sort_order: number;
  name: string;
  is_active: boolean;
}

export interface TreeRow<T extends TreeCategory> {
  category: T;
  depth: 0 | 1;
  /** True when the category itself is shown but a hidden parent keeps it out of the app. */
  hiddenByParent: boolean;
}

const bySort = <T extends TreeCategory>(a: T, b: T) => a.sort_order - b.sort_order || a.name.localeCompare(b.name);

/** Top-level categories in order, each followed by its sub-categories in order. A sub-category whose parent is missing is shown at the top level. */
export function buildRows<T extends TreeCategory>(list: T[]): TreeRow<T>[] {
  const ids = new Set(list.map((c) => c.id));
  const tops = list.filter((c) => c.parent_id === null || !ids.has(c.parent_id)).sort(bySort);
  const rows: TreeRow<T>[] = [];
  for (const top of tops) {
    rows.push({ category: top, depth: 0, hiddenByParent: false });
    for (const child of list.filter((c) => c.parent_id === top.id).sort(bySort)) {
      rows.push({ category: child, depth: 1, hiddenByParent: !top.is_active });
    }
  }
  return rows;
}

/** The ids of the categories that share `parentId`, in their current order. */
export function siblingIds<T extends TreeCategory>(list: T[], parentId: string | null): string[] {
  return list.filter((c) => c.parent_id === parentId).sort(bySort).map((c) => c.id);
}

/** Moves one id up (-1) or down (+1). Returns the same order when it is already at the edge. */
export function moveId(ids: string[], id: string, delta: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Drag and drop: puts `dragged` where `target` is. Returns the same order when either is missing or they are the same. */
export function dropOnto(ids: string[], dragged: string, target: string): string[] {
  if (dragged === target) return ids;
  const from = ids.indexOf(dragged);
  const to = ids.indexOf(target);
  if (from < 0 || to < 0) return ids;
  const next = ids.filter((id) => id !== dragged);
  next.splice(to, 0, dragged);
  return next;
}

/** The list with new sort orders (1, 2, 3 ...) for the given sibling ids. Categories not in `ids` are untouched. */
export function applyOrder<T extends TreeCategory>(list: T[], ids: string[]): T[] {
  const position = new Map(ids.map((id, i) => [id, i + 1]));
  return list.map((c) => (position.has(c.id) ? { ...c, sort_order: position.get(c.id)! } : c));
}

export const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);
