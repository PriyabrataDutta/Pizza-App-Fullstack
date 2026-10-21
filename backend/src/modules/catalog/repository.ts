import "server-only";
import { adminClient } from "@/shared/supabase/server";
import type {
  AttachmentRow, CategoryRow, Diet, GroupRow, OptionPriceRow, OptionRow, PortionRow, ProductRow, TagRow,
} from "./types";

/** Everything the catalog service needs from storage. The service depends on this interface, so tests can pass an in-memory one. */
export interface CatalogRepository {
  version(): Promise<number>;
  categories(): Promise<CategoryRow[]>;
  tags(): Promise<TagRow[]>;
  productsPage(query: ProductQuery): Promise<{ rows: ProductRow[]; hasMore: boolean }>;
  product(id: string): Promise<ProductRow | null>;
  portionsFor(productIds: string[]): Promise<PortionRow[]>;
  attachmentsFor(scope: { categoryIds: string[]; productIds: string[] }): Promise<AttachmentRow[]>;
  groupsWithOptions(groupIds: string[]): Promise<{ groups: GroupRow[]; options: OptionRow[] }>;
  pricesFor(attachmentIds: string[]): Promise<OptionPriceRow[]>;
  tagKeysFor(productIds: string[]): Promise<Map<string, string[]>>;
}

export interface ProductQuery {
  /** Only products in these categories (already limited to visible ones). */
  categoryIds: string[];
  /** Match name or description, or belong to one of `searchCategoryIds` (so "pizza" finds every pizza). */
  search?: string;
  searchCategoryIds?: string[];
  tag?: string;
  diet?: Diet;
  spicy?: boolean;
  bestseller?: boolean;
  offset: number;
  limit: number;
}

function check<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`catalog: ${what}: ${result.error.message}`);
  return result.data as T;
}

/** Characters that have a meaning inside a PostgREST `or(...)` filter or an ILIKE pattern. */
export function sanitizeSearch(text: string): string {
  return text.replace(/[,()%*\\_"'`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export const supabaseCatalogRepository: CatalogRepository = {
  async version() {
    const result = await adminClient().from("catalog_meta").select("version").eq("id", 1).single<{ version: number | string }>();
    return Number(check(result, "version").version);
  },

  async categories() {
    return check(
      await adminClient().from("categories").select("*").order("sort_order").order("name"),
      "categories",
    ) as CategoryRow[];
  },

  async tags() {
    return check(await adminClient().from("tags").select("key,label,sort_order").order("sort_order").order("label"), "tags") as TagRow[];
  },

  async productsPage(q) {
    if (q.categoryIds.length === 0) return { rows: [], hasMore: false };
    const db = adminClient();
    let productIdsForTag: string[] | undefined;
    if (q.tag) {
      const tag = check(await db.from("tags").select("id").eq("key", q.tag).maybeSingle(), "tag") as { id: string } | null;
      if (!tag) return { rows: [], hasMore: false };
      const links = check(await db.from("product_tags").select("product_id").eq("tag_id", tag.id), "product tags") as { product_id: string }[];
      productIdsForTag = links.map((l) => l.product_id);
      if (productIdsForTag.length === 0) return { rows: [], hasMore: false };
    }

    let query = db.from("products").select("*").eq("is_active", true).in("category_id", q.categoryIds);
    if (productIdsForTag) query = query.in("id", productIdsForTag);
    if (q.diet) query = query.eq("diet", q.diet);
    if (q.spicy) query = query.eq("is_spicy", true);
    if (q.bestseller) query = query.eq("is_bestseller", true);
    if (q.search) {
      const s = sanitizeSearch(q.search);
      if (s) {
        const parts = [`name.ilike.%${s}%`, `description.ilike.%${s}%`];
        if (q.searchCategoryIds && q.searchCategoryIds.length > 0) parts.push(`category_id.in.(${q.searchCategoryIds.join(",")})`);
        query = query.or(parts.join(","));
      }
    }
    // One extra row tells us whether another page exists.
    const rows = check(
      await query.order("sort_order").order("name").order("id").range(q.offset, q.offset + q.limit),
      "products",
    ) as ProductRow[];
    return { rows: rows.slice(0, q.limit), hasMore: rows.length > q.limit };
  },

  async product(id) {
    const row = check(await adminClient().from("products").select("*").eq("id", id).eq("is_active", true).maybeSingle(), "product");
    return (row as ProductRow | null) ?? null;
  },

  async portionsFor(productIds) {
    if (productIds.length === 0) return [];
    return check(
      await adminClient().from("product_portions").select("*").in("product_id", productIds).order("sort_order"),
      "portions",
    ) as PortionRow[];
  },

  async attachmentsFor({ categoryIds, productIds }) {
    const db = adminClient();
    const out: AttachmentRow[] = [];
    if (categoryIds.length > 0) {
      out.push(...(check(await db.from("group_attachments").select("*").eq("scope", "category").in("category_id", categoryIds), "category attachments") as AttachmentRow[]));
    }
    if (productIds.length > 0) {
      out.push(...(check(await db.from("group_attachments").select("*").eq("scope", "product").in("product_id", productIds), "product attachments") as AttachmentRow[]));
    }
    return out;
  },

  async groupsWithOptions(groupIds) {
    if (groupIds.length === 0) return { groups: [], options: [] };
    const db = adminClient();
    const groups = check(await db.from("option_groups").select("*").in("id", groupIds), "groups") as GroupRow[];
    const options = check(await db.from("options").select("*").in("group_id", groupIds).order("sort_order"), "options") as OptionRow[];
    return { groups, options };
  },

  async pricesFor(attachmentIds) {
    if (attachmentIds.length === 0) return [];
    return check(await adminClient().from("option_prices").select("*").in("attachment_id", attachmentIds), "option prices") as OptionPriceRow[];
  },

  async tagKeysFor(productIds) {
    const map = new Map<string, string[]>();
    if (productIds.length === 0) return map;
    const rows = check(
      await adminClient().from("product_tags").select("product_id, tags(key)").in("product_id", productIds),
      "product tags",
    ) as unknown as { product_id: string; tags: { key: string } | { key: string }[] | null }[];
    for (const row of rows) {
      const tag = Array.isArray(row.tags) ? row.tags[0] : row.tags;
      if (!tag) continue;
      map.set(row.product_id, [...(map.get(row.product_id) ?? []), tag.key]);
    }
    return map;
  },
};
