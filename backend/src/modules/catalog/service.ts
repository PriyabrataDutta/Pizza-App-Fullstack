import type { CatalogRepository } from "./repository";
import { resolveProduct } from "./resolver";
import type { CategoryRow, Diet, Fulfillment, ProductBundle, ProductRow, ResolvedPortion, ResolvedProduct } from "./types";
import { thumbPath } from "./image-paths";

// Customer-facing catalog use cases. Only active products in active categories are ever returned.

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface CategoryDto {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  description: string;
  image_url: string | null;
  thumb_url: string | null;
  icon_key: string | null;
  sort_order: number;
}

export interface ProductListItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  image_url: string | null;
  thumb_url: string | null;
  diet: Diet;
  is_spicy: boolean;
  is_bestseller: boolean;
  is_new: boolean;
  fulfillment: Fulfillment;
  tags: string[];
  currency: string;
  portions: ResolvedPortion[];
  /** False when no portion can be ordered right now. */
  available: boolean;
  /** True when a required choice must be made first, so the "+" button has to open the product instead of adding it directly. */
  needs_choices: boolean;
}

export interface ProductListQuery {
  category?: string;
  search?: string;
  tag?: string;
  diet?: string;
  spicy?: boolean;
  bestseller?: boolean;
  cursor?: string;
  limit?: number;
}

export interface FiltersDto {
  diet: { key: Diet; label: string }[];
  flags: { key: "spicy" | "bestseller"; label: string }[];
  tags: { key: string; label: string }[];
}

export const DEFAULT_LIMIT = 30;
export const MAX_LIMIT = 200;

export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString("base64url");
}

export function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { o?: unknown };
    if (typeof parsed.o === "number" && Number.isInteger(parsed.o) && parsed.o >= 0) return parsed.o;
  } catch {
    // fall through
  }
  throw new ValidationError("The cursor is not valid. Start again from the first page.");
}

export function createCatalogService(repo: CatalogRepository, imageUrl: (path: string | null) => string | null) {
  /** Active categories whose parent (if any) is also active. A hidden parent hides its sub-categories. */
  async function visibleCategories(): Promise<CategoryRow[]> {
    const all = await repo.categories();
    const activeIds = new Set(all.filter((c) => c.is_active).map((c) => c.id));
    return all.filter((c) => c.is_active && (c.parent_id === null || activeIds.has(c.parent_id)));
  }

  return {
    version: () => repo.version(),

    async categories(): Promise<CategoryDto[]> {
      return (await visibleCategories()).map((c) => ({
        id: c.id, parent_id: c.parent_id, slug: c.slug, name: c.name, description: c.description,
        image_url: imageUrl(c.image_path), thumb_url: imageUrl(thumbPath(c.image_path)), icon_key: c.icon_key, sort_order: c.sort_order,
      }));
    },

    async filters(): Promise<FiltersDto> {
      const tags = await repo.tags();
      return {
        diet: [{ key: "veg", label: "Veg" }, { key: "non_veg", label: "Non-veg" }],
        flags: [{ key: "spicy", label: "Spicy" }, { key: "bestseller", label: "Popular" }],
        tags: tags.map((t) => ({ key: t.key, label: t.label })),
      };
    },

    async products(q: ProductListQuery): Promise<{ items: ProductListItem[]; next_cursor: string | null }> {
      const limit = q.limit ?? DEFAULT_LIMIT;
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new ValidationError(`limit must be between 1 and ${MAX_LIMIT}.`);
      if (q.diet && q.diet !== "veg" && q.diet !== "non_veg") throw new ValidationError("diet must be veg or non_veg.");
      const offset = decodeCursor(q.cursor);

      const categories = await visibleCategories();
      let categoryIds = categories.map((c) => c.id);
      if (q.category) {
        // A category given by id or slug includes its sub-categories.
        const chosen = categories.find((c) => c.id === q.category || c.slug === q.category);
        if (!chosen) return { items: [], next_cursor: null };
        categoryIds = [chosen.id, ...categories.filter((c) => c.parent_id === chosen.id).map((c) => c.id)];
      }

      const search = q.search?.trim();
      const searchCategoryIds = search
        ? categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())).map((c) => c.id)
        : [];

      const page = await repo.productsPage({
        categoryIds, search, searchCategoryIds, tag: q.tag, diet: q.diet as Diet | undefined,
        spicy: q.spicy, bestseller: q.bestseller, offset, limit,
      });
      const productIds = page.rows.map((p) => p.id);
      const [portions, tagMap, attachments] = await Promise.all([
        repo.portionsFor(productIds),
        repo.tagKeysFor(productIds),
        repo.attachmentsFor({ categoryIds: [...new Set(page.rows.map((p) => p.category_id))], productIds }),
      ]);
      const { groups, options } = await repo.groupsWithOptions([...new Set(attachments.map((a) => a.group_id))]);

      const requiredGroupIds = new Set(
        groups.filter((g) => g.is_active && g.is_required && options.some((o) => o.group_id === g.id && o.is_active)).map((g) => g.id),
      );

      const items: ProductListItem[] = page.rows.map((p: ProductRow) => {
        const own = portions.filter((x) => x.product_id === p.id).sort((a, b) => a.sort_order - b.sort_order);
        const applicable = attachments.filter(
          (a) => (a.scope === "category" && a.category_id === p.category_id) || (a.scope === "product" && a.product_id === p.id),
        );
        return {
          id: p.id, category_id: p.category_id, name: p.name, description: p.description, image_url: imageUrl(p.image_path), thumb_url: imageUrl(thumbPath(p.image_path)),
          diet: p.diet, is_spicy: p.is_spicy, is_bestseller: p.is_bestseller, is_new: p.is_new, fulfillment: p.fulfillment,
          tags: tagMap.get(p.id) ?? [], currency: own[0]?.currency ?? "EUR",
          portions: own.map((x) => ({ key: x.key, label: x.label, price_minor: x.price_minor, available: x.is_available })),
          available: own.some((x) => x.is_available),
          needs_choices: applicable.some((a) => requiredGroupIds.has(a.group_id)),
        };
      });
      return { items, next_cursor: page.hasMore ? encodeCursor(offset + limit) : null };
    },

    /** One product, fully resolved. Null when it does not exist, is hidden, or its category is hidden. */
    async product(id: string): Promise<ResolvedProduct | null> {
      const product = await repo.product(id);
      if (!product) return null;
      const categories = await visibleCategories();
      if (!categories.some((c) => c.id === product.category_id)) return null;

      const [portions, attachments, tagMap] = await Promise.all([
        repo.portionsFor([product.id]),
        repo.attachmentsFor({ categoryIds: [product.category_id], productIds: [product.id] }),
        repo.tagKeysFor([product.id]),
      ]);
      const { groups, options } = await repo.groupsWithOptions([...new Set(attachments.map((a) => a.group_id))]);
      const prices = await repo.pricesFor(attachments.map((a) => a.id));

      const bundle: ProductBundle = {
        product, portions,
        categoryAttachments: attachments.filter((a) => a.scope === "category"),
        productAttachments: attachments.filter((a) => a.scope === "product"),
        groups, options, prices, tags: tagMap.get(product.id) ?? [],
      };
      return resolveProduct(bundle, imageUrl);
    },
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
