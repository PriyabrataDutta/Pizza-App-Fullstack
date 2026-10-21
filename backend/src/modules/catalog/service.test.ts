import { describe, expect, it } from "vitest";
import type { CatalogRepository, ProductQuery } from "./repository";
import { createCatalogService, decodeCursor, encodeCursor, ValidationError } from "./service";
import type { AttachmentRow, CategoryRow, GroupRow, OptionPriceRow, OptionRow, PortionRow, ProductRow } from "./types";

// The service is exercised against an in-memory repository: same rules, no database.

const cat = (id: string, name: string, extra: Partial<CategoryRow> = {}): CategoryRow => ({
  id, parent_id: null, slug: id, name, description: "", image_path: null, icon_key: null, sort_order: 0, is_active: true,
  default_portion_set_id: null, ...extra,
});
const prod = (id: string, categoryId: string, name: string, extra: Partial<ProductRow> = {}): ProductRow => ({
  id, category_id: categoryId, slug: id, name, description: "", image_path: null, diet: "veg", is_spicy: false, is_bestseller: false,
  is_new: false, allergens: [], fulfillment: "delivery_and_pickup", sort_order: 0, is_active: true, ...extra,
});
const portion = (productId: string, key: string, cents: number, available = true): PortionRow => ({
  product_id: productId, key, label: key, price_minor: cents, currency: "EUR", sku: null, is_available: available, sort_order: 0,
});

function fakeRepo(data: {
  categories: CategoryRow[]; products: ProductRow[]; portions: PortionRow[]; attachments?: AttachmentRow[];
  groups?: GroupRow[]; options?: OptionRow[]; prices?: OptionPriceRow[];
}): CatalogRepository {
  const attachments = data.attachments ?? [];
  return {
    version: async () => 7,
    categories: async () => data.categories,
    tags: async () => [{ key: "vegan", label: "Vegan", sort_order: 0 }],
    async productsPage(q: ProductQuery) {
      let rows = data.products.filter((p) => p.is_active && q.categoryIds.includes(p.category_id));
      if (q.diet) rows = rows.filter((p) => p.diet === q.diet);
      if (q.spicy) rows = rows.filter((p) => p.is_spicy);
      if (q.search) {
        const s = q.search.toLowerCase();
        rows = rows.filter((p) => p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s) || (q.searchCategoryIds ?? []).includes(p.category_id));
      }
      const slice = rows.slice(q.offset, q.offset + q.limit + 1);
      return { rows: slice.slice(0, q.limit), hasMore: slice.length > q.limit };
    },
    product: async (id) => data.products.find((p) => p.id === id && p.is_active) ?? null,
    portionsFor: async (ids) => data.portions.filter((p) => ids.includes(p.product_id)),
    attachmentsFor: async ({ categoryIds, productIds }) =>
      attachments.filter((a) => (a.scope === "category" ? categoryIds.includes(a.category_id!) : productIds.includes(a.product_id!))),
    groupsWithOptions: async (ids) => ({
      groups: (data.groups ?? []).filter((g) => ids.includes(g.id)),
      options: (data.options ?? []).filter((o) => ids.includes(o.group_id)),
    }),
    pricesFor: async (ids) => (data.prices ?? []).filter((p) => ids.includes(p.attachment_id)),
    tagKeysFor: async () => new Map(),
  };
}

const noImage = () => null;

const base = {
  categories: [cat("pizza", "Pizza", { sort_order: 1 }), cat("drinks", "Getränke", { sort_order: 2 })],
  products: [
    prod("margherita", "pizza", "Margherita"),
    prod("diavolo", "pizza", "Diavolo", { diet: "non_veg", is_spicy: true }),
    prod("cola", "drinks", "Cola"),
  ],
  portions: [portion("margherita", "klein", 550), portion("margherita", "gross", 750), portion("diavolo", "klein", 800), portion("cola", "std", 200)],
};

describe("catalog service", () => {
  it("lists categories and hides inactive ones together with their sub-categories", async () => {
    const svc = createCatalogService(
      fakeRepo({
        ...base,
        categories: [
          cat("pizza", "Pizza"), cat("old", "Old", { is_active: false }), cat("old-sub", "Old sub", { parent_id: "old" }),
          cat("pizza-sub", "Specials", { parent_id: "pizza" }),
        ],
      }),
      noImage,
    );
    expect((await svc.categories()).map((c) => c.id)).toEqual(["pizza", "pizza-sub"]);
  });

  it("returns only products of visible categories and only active products", async () => {
    const svc = createCatalogService(
      fakeRepo({
        ...base,
        categories: [cat("pizza", "Pizza"), cat("drinks", "Getränke", { is_active: false })],
        products: [...base.products, prod("hidden", "pizza", "Hidden", { is_active: false })],
      }),
      noImage,
    );
    expect((await svc.products({})).items.map((p) => p.id)).toEqual(["margherita", "diavolo"]);
  });

  it("filters by category (id or slug, including sub-categories), diet and spicy", async () => {
    const svc = createCatalogService(fakeRepo(base), noImage);
    expect((await svc.products({ category: "drinks" })).items.map((p) => p.id)).toEqual(["cola"]);
    expect((await svc.products({ diet: "non_veg" })).items.map((p) => p.id)).toEqual(["diavolo"]);
    expect((await svc.products({ spicy: true })).items.map((p) => p.id)).toEqual(["diavolo"]);
    expect((await svc.products({ category: "nope" })).items).toEqual([]);
  });

  it("finds products by category name as well as by name", async () => {
    const svc = createCatalogService(fakeRepo(base), noImage);
    expect((await svc.products({ search: "pizza" })).items.map((p) => p.id)).toEqual(["margherita", "diavolo"]);
    expect((await svc.products({ search: "cola" })).items.map((p) => p.id)).toEqual(["cola"]);
  });

  it("pages with an opaque cursor", async () => {
    const svc = createCatalogService(fakeRepo(base), noImage);
    const first = await svc.products({ limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.next_cursor).not.toBeNull();
    const second = await svc.products({ limit: 2, cursor: first.next_cursor! });
    expect(second.items.map((p) => p.id)).toEqual(["cola"]);
    expect(second.next_cursor).toBeNull();
  });

  it("rejects a bad limit, diet or cursor with a validation error", async () => {
    const svc = createCatalogService(fakeRepo(base), noImage);
    await expect(svc.products({ limit: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.products({ limit: 201 })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.products({ diet: "vegan" })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.products({ cursor: "garbage" })).rejects.toBeInstanceOf(ValidationError);
    expect(decodeCursor(encodeCursor(40))).toBe(40);
  });

  it("marks products that need a choice before they can be added, and sold-out ones as unavailable", async () => {
    const svc = createCatalogService(
      fakeRepo({
        ...base,
        portions: [...base.portions.filter((p) => p.product_id !== "cola"), portion("cola", "std", 200, false)],
        attachments: [{ id: "a1", scope: "category", category_id: "pizza", product_id: null, group_id: "g-crust", sort_order: 0, default_option_id: null }],
        groups: [{ id: "g-crust", name: "Crust", kind: "choice", min_select: 1, max_select: 1, is_required: true, is_active: true }],
        options: [{ id: "o1", group_id: "g-crust", name: "Thin", default_price_minor: 0, sort_order: 0, is_active: true }],
      }),
      noImage,
    );
    const items = (await svc.products({})).items;
    expect(items.find((p) => p.id === "margherita")!.needs_choices).toBe(true);
    expect(items.find((p) => p.id === "cola")!.needs_choices).toBe(false);
    expect(items.find((p) => p.id === "cola")!.available).toBe(false);
  });

  it("resolves one product and returns null for hidden or unknown ones", async () => {
    const svc = createCatalogService(fakeRepo(base), noImage);
    expect((await svc.product("margherita"))!.portions.map((p) => p.key)).toEqual(["klein", "gross"]);
    expect(await svc.product("missing")).toBeNull();
    const hiddenCategory = createCatalogService(fakeRepo({ ...base, categories: [cat("pizza", "Pizza", { is_active: false }), cat("drinks", "Getränke")] }), noImage);
    expect(await hiddenCategory.product("margherita")).toBeNull();
  });

  it("offers the filters the app shows", async () => {
    const f = await createCatalogService(fakeRepo(base), noImage).filters();
    expect(f.diet.map((d) => d.key)).toEqual(["veg", "non_veg"]);
    expect(f.tags).toEqual([{ key: "vegan", label: "Vegan" }]);
  });
});
