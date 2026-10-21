import type { ResolvedProduct } from "./types";

// Selection validation and line pricing, from an already resolved product. Pure: used by the catalog API now and by
// checkout later, so the app and the server can never disagree about a price. A client only ever sends ids and quantity.

export const MAX_QUANTITY = 99;

export interface Selection {
  portionKey: string;
  optionIds: string[];
  quantity: number;
}

export type IssueCode =
  | "PORTION_UNKNOWN"
  | "PORTION_UNAVAILABLE"
  | "OPTION_UNKNOWN"
  | "OPTION_DUPLICATE"
  | "GROUP_MIN"
  | "GROUP_MAX"
  | "QUANTITY_INVALID"
  | "PICKUP_ONLY";

export interface SelectionIssue {
  code: IssueCode;
  message: string;
  groupId?: string;
}

export interface PricedOption {
  groupId: string;
  groupName: string;
  optionId: string;
  name: string;
  priceMinor: number;
}

export type PricingResult =
  | { ok: true; portionLabel: string; basePriceMinor: number; unitPriceMinor: number; totalMinor: number; options: PricedOption[] }
  | { ok: false; issues: SelectionIssue[] };

export function validateSelection(product: ResolvedProduct, selection: Selection, opts: { forDelivery?: boolean } = {}): SelectionIssue[] {
  const issues: SelectionIssue[] = [];
  const forDelivery = opts.forDelivery ?? true;

  if (forDelivery && product.fulfillment === "pickup_only") {
    issues.push({ code: "PICKUP_ONLY", message: `${product.name} is only available for pickup.` });
  }
  if (!Number.isInteger(selection.quantity) || selection.quantity < 1 || selection.quantity > MAX_QUANTITY) {
    issues.push({ code: "QUANTITY_INVALID", message: `Quantity must be between 1 and ${MAX_QUANTITY}.` });
  }

  const portion = product.portions.find((p) => p.key === selection.portionKey);
  if (!portion) {
    issues.push({ code: "PORTION_UNKNOWN", message: "That portion does not exist for this product." });
  } else if (!portion.available) {
    issues.push({ code: "PORTION_UNAVAILABLE", message: `${portion.label} is not available right now.` });
  }

  const seen = new Set<string>();
  const countByGroup = new Map<string, number>();
  for (const optionId of selection.optionIds) {
    if (seen.has(optionId)) {
      issues.push({ code: "OPTION_DUPLICATE", message: "An option can be chosen only once." });
      continue;
    }
    seen.add(optionId);
    const group = product.groups.find((g) => g.options.some((o) => o.id === optionId));
    if (!group) {
      issues.push({ code: "OPTION_UNKNOWN", message: "One of the chosen options does not belong to this product." });
      continue;
    }
    countByGroup.set(group.id, (countByGroup.get(group.id) ?? 0) + 1);
  }

  for (const group of product.groups) {
    const count = countByGroup.get(group.id) ?? 0;
    const min = group.required ? Math.max(group.min, 1) : group.min;
    if (count < min) {
      issues.push({ code: "GROUP_MIN", groupId: group.id, message: `Choose at least ${min} for ${group.name}.` });
    }
    if (count > group.max) {
      issues.push({ code: "GROUP_MAX", groupId: group.id, message: `Choose at most ${group.max} for ${group.name}.` });
    }
  }
  return issues;
}

/** Price of one line: portion price plus each chosen extra's price for that portion, times the quantity. */
export function priceSelection(product: ResolvedProduct, selection: Selection, opts: { forDelivery?: boolean } = {}): PricingResult {
  const issues = validateSelection(product, selection, opts);
  if (issues.length > 0) return { ok: false, issues };

  const portion = product.portions.find((p) => p.key === selection.portionKey)!;
  const options: PricedOption[] = [];
  for (const optionId of selection.optionIds) {
    const group = product.groups.find((g) => g.options.some((o) => o.id === optionId))!;
    const option = group.options.find((o) => o.id === optionId)!;
    const priceMinor = group.kind === "extra" ? (option.prices[portion.key] ?? 0) : 0;
    options.push({ groupId: group.id, groupName: group.name, optionId, name: option.name, priceMinor });
  }
  const unitPriceMinor = portion.price_minor + options.reduce((sum, o) => sum + o.priceMinor, 0);
  return {
    ok: true,
    portionLabel: portion.label,
    basePriceMinor: portion.price_minor,
    unitPriceMinor,
    totalMinor: unitPriceMinor * selection.quantity,
    options,
  };
}
