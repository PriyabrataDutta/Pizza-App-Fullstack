import { describe, expect, it, vi } from "vitest";
import { createSnapshotRepository, type CatalogData } from "./snapshot";
import type { ProductRow } from "./types";

const product = (over: Partial<ProductRow> & { id: string }): ProductRow =>
  ({ category_id: "pizza", name: over.id, description: "", diet: "veg", is_spicy: false, is_bestseller: false, is_new: false, sort_order: 1, is_active: true, ...over }) as ProductRow;

function data(): CatalogData {
  return {
    categories: [{ id: "pizza", name: "Pizza" }, { id: "drinks", name: "Getränke" }] as CatalogData["categories"],
    tags: [{ key: "vegan", label: "Vegan", sort_order: 1 }],
    products: [
      product({ id: "margherita", name: "Margherita", description: "mit Käse", is_bestseller: true, sort_order: 1 }),
      product({ id: "salami", name: "Salami", description: "mit Salami", diet: "non_veg", is_spicy: true, sort_order: 2 }),
      product({ id: "cola", name: "Cola", category_id: "drinks", sort_order: 1 }),
    ],
    portions: [
      { product_id: "margherita", key: "gross", sort_order: 2 },
      { product_id: "margherita", key: "klein", sort_order: 1 },
    ] as unknown as CatalogData["portions"],
    attachments: [
      { id: "a1", scope: "category", category_id: "pizza", product_id: null, group_id: "g1", sort_order: 1 },
      { id: "a2", scope: "product", category_id: null, product_id: "salami", group_id: "g2", sort_order: 1 },
    ] as CatalogData["attachments"],
    groups: [{ id: "g1", name: "Extras" }, { id: "g2", name: "Sauce" }] as CatalogData["groups"],
    options: [
      { id: "o2", group_id: "g1", name: "Mais", sort_order: 2 },
      { id: "o1", group_id: "g1", name: "Pilze", sort_order: 1 },
    ] as CatalogData["options"],
    prices: [{ attachment_id: "a1", option_id: "o1", portion_key: "klein", price_minor: 50 }] as unknown as CatalogData["prices"],
    productTags: [{ product_id: "margherita", tag_key: "vegan" }],
  };
}

function setup(versions: number[] = [1]) {
  let i = 0;
  const source = {
    version: vi.fn(async () => versions[Math.min(i++, versions.length - 1)]),
    load: vi.fn(async () => data()),
  };
  let clock = 0;
  const repo = createSnapshotRepository(source, { versionTtlMs: 3000, now: () => clock });
  return { source, repo, tick: (ms: number) => { clock += ms; } };
}

const query = (over = {}) => ({ categoryIds: ["pizza", "drinks"], offset: 0, limit: 10, ...over });

describe("snapshot repository", () => {
  it("loads once and answers many reads without asking again", async () => {
    const { source, repo } = setup();
    await repo.categories();
    await repo.productsPage(query());
    await repo.product("salami");
    await repo.portionsFor(["margherita"]);
    expect(source.load).toHaveBeenCalledTimes(1);
    expect(source.version).toHaveBeenCalledTimes(1);
  });

  it("checks the version again only after the trust window", async () => {
    const { source, repo, tick } = setup([1, 1]);
    await repo.version();
    tick(2000);
    await repo.version();
    expect(source.version).toHaveBeenCalledTimes(1);
    tick(1500);
    await repo.version();
    expect(source.version).toHaveBeenCalledTimes(2);
    expect(source.load).toHaveBeenCalledTimes(1); // same version: no reload
  });

  it("reloads when the version changes", async () => {
    const { source, repo, tick } = setup([1, 2]);
    await repo.categories();
    tick(4000);
    await repo.categories();
    expect(source.load).toHaveBeenCalledTimes(2);
  });

  it("loads once when many requests arrive together", async () => {
    const { source, repo } = setup();
    await Promise.all([repo.categories(), repo.productsPage(query()), repo.product("cola"), repo.tags()]);
    expect(source.load).toHaveBeenCalledTimes(1);
  });

  it("keeps serving the last copy if the database cannot be reached", async () => {
    const { source, repo, tick } = setup([1, 2]);
    await repo.categories();
    source.load.mockRejectedValueOnce(new Error("down"));
    tick(4000);
    expect((await repo.categories()).length).toBe(2);
  });

  it("fails when there is nothing to fall back on", async () => {
    const { source, repo } = setup();
    source.load.mockRejectedValueOnce(new Error("down"));
    await expect(repo.categories()).rejects.toThrow("down");
  });

  it("refresh() checks the version now, not after the window", async () => {
    const { source, repo, tick } = setup([1, 2]);
    await repo.categories();
    tick(600);
    await repo.refresh(500);
    expect(source.version).toHaveBeenCalledTimes(2);
    expect(source.load).toHaveBeenCalledTimes(2);
  });

  describe("products", () => {
    it("filters by category, ordered by sort order then name", async () => {
      const { repo } = setup();
      expect((await repo.productsPage(query({ categoryIds: ["pizza"] }))).rows.map((p) => p.id)).toEqual(["margherita", "salami"]);
      expect((await repo.productsPage(query({ categoryIds: [] }))).rows).toEqual([]);
    });

    it("filters by diet, spicy, bestseller and tag", async () => {
      const { repo } = setup();
      const ids = async (q: object) => (await repo.productsPage(query(q))).rows.map((p) => p.id);
      expect(await ids({ diet: "non_veg" })).toEqual(["salami"]);
      expect(await ids({ spicy: true })).toEqual(["salami"]);
      expect(await ids({ bestseller: true })).toEqual(["margherita"]);
      expect(await ids({ tag: "vegan" })).toEqual(["margherita"]);
      expect(await ids({ tag: "unknown" })).toEqual([]);
    });

    it("searches name and description in any letter case, and by category", async () => {
      const { repo } = setup();
      const ids = async (q: object) => (await repo.productsPage(query(q))).rows.map((p) => p.id);
      expect(await ids({ search: "KÄSE" })).toEqual(["margherita"]);
      expect(await ids({ search: "sala" })).toEqual(["salami"]);
      expect(await ids({ search: "getränk", searchCategoryIds: ["drinks"] })).toEqual(["cola"]);
      expect(await ids({ search: "nothing" })).toEqual([]);
    });

    it("pages with hasMore", async () => {
      const { repo } = setup();
      const first = await repo.productsPage(query({ limit: 2 }));
      expect(first.rows.length).toBe(2);
      expect(first.hasMore).toBe(true);
      const second = await repo.productsPage(query({ limit: 2, offset: 2 }));
      expect(second.rows.length).toBe(1);
      expect(second.hasMore).toBe(false);
    });

    it("finds a product by id", async () => {
      const { repo } = setup();
      expect((await repo.product("cola"))?.name).toBe("Cola");
      expect(await repo.product("missing")).toBeNull();
    });
  });

  describe("related data", () => {
    it("returns sizes in order", async () => {
      const { repo } = setup();
      expect((await repo.portionsFor(["margherita"])).map((p) => p.key)).toEqual(["klein", "gross"]);
      expect(await repo.portionsFor([])).toEqual([]);
    });

    it("returns the groups attached to a category or a product", async () => {
      const { repo } = setup();
      const found = await repo.attachmentsFor({ categoryIds: ["pizza"], productIds: ["salami"] });
      expect(found.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
      expect(await repo.attachmentsFor({ categoryIds: [], productIds: [] })).toEqual([]);
    });

    it("returns groups with their options in order, and prices by attachment", async () => {
      const { repo } = setup();
      const { groups, options } = await repo.groupsWithOptions(["g1"]);
      expect(groups.map((g) => g.id)).toEqual(["g1"]);
      expect(options.map((o) => o.id)).toEqual(["o1", "o2"]);
      expect((await repo.pricesFor(["a1"])).length).toBe(1);
      expect(await repo.pricesFor(["zzz"])).toEqual([]);
    });

    it("returns tag keys by product", async () => {
      const { repo } = setup();
      const map = await repo.tagKeysFor(["margherita", "salami"]);
      expect(map.get("margherita")).toEqual(["vegan"]);
      expect(map.has("salami")).toBe(false);
    });
  });
});
