import type { CatalogRepository, ProductQuery } from "./repository";
import type { AttachmentRow, CategoryRow, Diet, GroupRow, OptionPriceRow, OptionRow, PortionRow, ProductRow, TagRow } from "./types";

// The whole menu is small (a couple of hundred items), so instead of asking the database a handful of questions for every request
// it is read once, in one parallel round trip, and answered from memory. It is read again only when the catalog version changes,
// and the version itself is checked at most every few seconds. Edits in the dashboard bump the version, so nothing goes stale.

export interface CatalogData {
  categories: CategoryRow[];
  tags: TagRow[];
  /** Active products only. */
  products: ProductRow[];
  portions: PortionRow[];
  attachments: AttachmentRow[];
  groups: GroupRow[];
  options: OptionRow[];
  prices: OptionPriceRow[];
  /** Every product-tag link, as the product id and the tag's key. */
  productTags: { product_id: string; tag_key: string }[];
}

export interface SnapshotSource {
  version(): Promise<number>;
  load(): Promise<CatalogData>;
}

const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

/** Same rule as the database filter: letters in any case, anywhere in the text. */
const contains = (text: string | null | undefined, needle: string) => (text ?? "").toLowerCase().includes(needle.toLowerCase());

/** Mirrors sanitizeSearch() in repository.ts, which strips characters that mean something to the database filter. */
function clean(text: string): string {
  return text.replace(/[,()%*\\_"'`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

/** Answers every catalog read from one in-memory copy of the data. [versionTtlMs] is how long a version check is trusted. */
export function createSnapshotRepository(source: SnapshotSource, options: { versionTtlMs?: number; now?: () => number } = {}): CatalogRepository & {
  /** Re-checks the version now (at most once per [maxAgeMs]). Used before pricing an order, so a just-changed price is never missed. */
  refresh(maxAgeMs?: number): Promise<void>;
} {
  const ttl = options.versionTtlMs ?? 3000;
  const now = options.now ?? Date.now;
  let snapshot: { version: number; data: CatalogData; index: Index } | null = null;
  let checked: { version: number; at: number } | null = null;
  let loading: Promise<void> | null = null;

  async function checkVersion(maxAgeMs: number): Promise<number> {
    if (checked && now() - checked.at < maxAgeMs) return checked.version;
    const version = await source.version();
    checked = { version, at: now() };
    return version;
  }

  async function current(maxAgeMs = ttl): Promise<{ version: number; data: CatalogData; index: Index }> {
    let version: number;
    try {
      version = await checkVersion(maxAgeMs);
    } catch (error) {
      if (snapshot) return snapshot; // the database is unreachable: keep serving the last copy
      throw error;
    }
    if (snapshot && snapshot.version === version) return snapshot;
    // One load at a time, however many requests arrive while it runs.
    loading ??= (async () => {
      try {
        const data = await source.load();
        snapshot = { version, data, index: buildIndex(data) };
      } finally {
        loading = null;
      }
    })();
    try {
      await loading;
    } catch (error) {
      if (snapshot) return snapshot;
      throw error;
    }
    return snapshot!;
  }

  return {
    async refresh(maxAgeMs = 0) {
      await current(maxAgeMs);
    },

    async version() {
      return (await current()).version;
    },

    async categories() {
      return (await current()).data.categories;
    },

    async tags() {
      return (await current()).data.tags;
    },

    async productsPage(q: ProductQuery) {
      if (q.categoryIds.length === 0) return { rows: [], hasMore: false };
      const { data, index } = await current();
      const categories = new Set(q.categoryIds);
      let tagged: Set<string> | undefined;
      if (q.tag) {
        tagged = index.productsByTag.get(q.tag);
        if (!tagged || tagged.size === 0) return { rows: [], hasMore: false };
      }
      const search = q.search ? clean(q.search) : "";
      const searchCategories = new Set(q.searchCategoryIds ?? []);
      let rows = data.products.filter((p) => {
        if (!categories.has(p.category_id)) return false;
        if (tagged && !tagged.has(p.id)) return false;
        if (q.diet && p.diet !== (q.diet as Diet)) return false;
        if (q.spicy && !p.is_spicy) return false;
        if (q.bestseller && !p.is_bestseller) return false;
        if (search && !(contains(p.name, search) || contains(p.description, search) || searchCategories.has(p.category_id))) return false;
        return true;
      });
      rows = rows.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id));
      return { rows: rows.slice(q.offset, q.offset + q.limit), hasMore: rows.length > q.offset + q.limit };
    },

    async product(id: string) {
      return (await current()).index.productsById.get(id) ?? null;
    },

    async portionsFor(productIds: string[]) {
      const { index } = await current();
      return productIds.flatMap((id) => index.portionsByProduct.get(id) ?? []);
    },

    async attachmentsFor({ categoryIds, productIds }) {
      const { index } = await current();
      return [
        ...categoryIds.flatMap((id) => index.attachmentsByCategory.get(id) ?? []),
        ...productIds.flatMap((id) => index.attachmentsByProduct.get(id) ?? []),
      ];
    },

    async groupsWithOptions(groupIds: string[]) {
      const { index } = await current();
      const groups = groupIds.map((id) => index.groupsById.get(id)).filter((g): g is GroupRow => !!g);
      const options = groupIds.flatMap((id) => index.optionsByGroup.get(id) ?? []);
      return { groups, options };
    },

    async pricesFor(attachmentIds: string[]) {
      const { index } = await current();
      return attachmentIds.flatMap((id) => index.pricesByAttachment.get(id) ?? []);
    },

    async tagKeysFor(productIds: string[]) {
      const { index } = await current();
      const map = new Map<string, string[]>();
      for (const id of productIds) {
        const keys = index.tagKeysByProduct.get(id);
        if (keys) map.set(id, keys);
      }
      return map;
    },
  };
}

// ---- Lookup tables, built once per snapshot ---------------------------------------------------------------------------------
interface Index {
  productsById: Map<string, ProductRow>;
  portionsByProduct: Map<string, PortionRow[]>;
  attachmentsByCategory: Map<string, AttachmentRow[]>;
  attachmentsByProduct: Map<string, AttachmentRow[]>;
  groupsById: Map<string, GroupRow>;
  optionsByGroup: Map<string, OptionRow[]>;
  pricesByAttachment: Map<string, OptionPriceRow[]>;
  tagKeysByProduct: Map<string, string[]>;
  productsByTag: Map<string, Set<string>>;
}

function group<T>(items: T[], key: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (k === null) continue;
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function buildIndex(data: CatalogData): Index {
  const sortedGroups = (map: Map<string, { sort_order: number }[]>) => { for (const list of map.values()) list.sort(bySort); };
  const portionsByProduct = group(data.portions, (p) => p.product_id);
  const optionsByGroup = group(data.options, (o) => o.group_id);
  sortedGroups(portionsByProduct);
  sortedGroups(optionsByGroup);
  const tagKeysByProduct = new Map<string, string[]>();
  const productsByTag = new Map<string, Set<string>>();
  for (const link of data.productTags) {
    tagKeysByProduct.set(link.product_id, [...(tagKeysByProduct.get(link.product_id) ?? []), link.tag_key]);
    const set = productsByTag.get(link.tag_key) ?? new Set<string>();
    set.add(link.product_id);
    productsByTag.set(link.tag_key, set);
  }
  return {
    productsById: new Map(data.products.map((p) => [p.id, p])),
    portionsByProduct,
    attachmentsByCategory: group(data.attachments.filter((a) => a.scope === "category"), (a) => a.category_id),
    attachmentsByProduct: group(data.attachments.filter((a) => a.scope === "product"), (a) => a.product_id),
    groupsById: new Map(data.groups.map((g) => [g.id, g])),
    optionsByGroup,
    pricesByAttachment: group(data.prices, (p) => p.attachment_id),
    tagKeysByProduct,
    productsByTag,
  };
}
