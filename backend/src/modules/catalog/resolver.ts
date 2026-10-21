import { thumbPath } from "./image-paths";
import type {
  AttachmentRow,
  OptionPriceRow,
  OptionRow,
  ProductBundle,
  ResolvedGroup,
  ResolvedOption,
  ResolvedProduct,
} from "./types";

// Pure functions only: no database, no network. Shared by the catalog API and (later) checkout, so a price is computed in one place.

/**
 * Price of one extra for one portion, in minor units. Lookup order, first match wins:
 *   product attachment + this portion, product attachment + any portion,
 *   category attachment + this portion, category attachment + any portion,
 *   then the option's own default price.
 */
export function extraPrice(
  option: OptionRow,
  portionKey: string,
  chain: AttachmentRow[], // product attachment first, then category attachment (either may be missing)
  prices: OptionPriceRow[],
): number {
  for (const attachment of chain) {
    const rows = prices.filter((p) => p.attachment_id === attachment.id && p.option_id === option.id);
    const exact = rows.find((p) => p.portion_key === portionKey);
    if (exact) return exact.price_minor;
    const any = rows.find((p) => p.portion_key === null);
    if (any) return any.price_minor;
  }
  return option.default_price_minor;
}

const bySortThenName = (a: { sort_order: number; name: string }, b: { sort_order: number; name: string }) =>
  a.sort_order - b.sort_order || a.name.localeCompare(b.name);

/**
 * Turns a loaded product into what customers see: its portions, and the groups that apply after inheritance.
 * A group attached to the product replaces the same group attached to the category (it is not listed twice), but
 * the category's prices still fill in where the product sets none.
 */
export function resolveProduct(bundle: ProductBundle, imageUrl: (path: string | null) => string | null): ResolvedProduct {
  const { product, portions, categoryAttachments, productAttachments, groups, options, prices } = bundle;

  const resolvedPortions = [...portions]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({ key: p.key, label: p.label, price_minor: p.price_minor, available: p.is_available }));

  const categoryByGroup = new Map(categoryAttachments.map((a) => [a.group_id, a]));
  const productByGroup = new Map(productAttachments.map((a) => [a.group_id, a]));

  // Category-level attachments the product does not override, then the product's own, each in their sort order.
  const ordered: AttachmentRow[] = [
    ...categoryAttachments.filter((a) => !productByGroup.has(a.group_id)),
    ...productAttachments,
  ].sort((a, b) => a.sort_order - b.sort_order);

  const resolvedGroups: ResolvedGroup[] = [];
  for (const attachment of ordered) {
    const group = groups.find((g) => g.id === attachment.group_id);
    if (!group || !group.is_active) continue;

    const activeOptions = options.filter((o) => o.group_id === group.id && o.is_active).sort(bySortThenName);
    if (activeOptions.length === 0) continue;

    const productAtt = productByGroup.get(group.id);
    const categoryAtt = categoryByGroup.get(group.id);
    const chain = [productAtt, categoryAtt].filter((a): a is AttachmentRow => a !== undefined);
    const defaultOptionId = productAtt?.default_option_id ?? categoryAtt?.default_option_id ?? null;

    const resolvedOptions: ResolvedOption[] = activeOptions.map((option) => ({
      id: option.id,
      name: option.name,
      is_default: option.id === defaultOptionId,
      prices:
        group.kind === "extra"
          ? Object.fromEntries(resolvedPortions.map((p) => [p.key, extraPrice(option, p.key, chain, prices)]))
          : {},
    }));

    resolvedGroups.push({
      id: group.id,
      name: group.name,
      kind: group.kind,
      min: group.min_select,
      max: group.max_select,
      required: group.is_required,
      options: resolvedOptions,
    });
  }

  return {
    id: product.id,
    category_id: product.category_id,
    name: product.name,
    description: product.description,
    image_url: imageUrl(product.image_path),
    thumb_url: imageUrl(thumbPath(product.image_path)),
    diet: product.diet,
    is_spicy: product.is_spicy,
    is_bestseller: product.is_bestseller,
    is_new: product.is_new,
    allergens: product.allergens,
    fulfillment: product.fulfillment,
    tags: bundle.tags,
    currency: portions[0]?.currency ?? "EUR",
    portions: resolvedPortions,
    groups: resolvedGroups,
  };
}
