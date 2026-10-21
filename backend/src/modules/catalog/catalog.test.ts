import { describe, expect, it } from "vitest";
import { priceSelection, validateSelection } from "./pricing";
import { resolveProduct } from "./resolver";
import type { AttachmentRow, GroupRow, OptionPriceRow, OptionRow, PortionRow, ProductBundle, ProductRow } from "./types";

// A slice of the Niki menu: pizza (three sizes, extras priced by size), a sheet pizza (flat extras), a pasta dish
// (free pasta choice with its own default, plus a flat cheese-bake extra).

const product = (id: string, categoryId: string, name: string, extra: Partial<ProductRow> = {}): ProductRow => ({
  id, category_id: categoryId, slug: id, name, description: "", image_path: null, diet: "veg", is_spicy: false,
  is_bestseller: false, is_new: false, allergens: [], fulfillment: "delivery_and_pickup", sort_order: 0, is_active: true, ...extra,
});
const portion = (productId: string, key: string, label: string, price: number, extra: Partial<PortionRow> = {}): PortionRow => ({
  product_id: productId, key, label, price_minor: price, currency: "EUR", sku: null, is_available: true, sort_order: 0, ...extra,
});
const group = (id: string, name: string, kind: "extra" | "choice", min: number, max: number, required = false, active = true): GroupRow => ({
  id, name, kind, min_select: min, max_select: max, is_required: required, is_active: active,
});
const option = (id: string, groupId: string, name: string, price = 0, extra: Partial<OptionRow> = {}): OptionRow => ({
  id, group_id: groupId, name, default_price_minor: price, sort_order: 0, is_active: true, ...extra,
});
const attach = (id: string, scope: "category" | "product", target: string, groupId: string, extra: Partial<AttachmentRow> = {}): AttachmentRow => ({
  id, scope, category_id: scope === "category" ? target : null, product_id: scope === "product" ? target : null,
  group_id: groupId, sort_order: 0, default_option_id: null, ...extra,
});
const price = (attachmentId: string, optionId: string, key: string | null, cents: number): OptionPriceRow => ({
  attachment_id: attachmentId, option_id: optionId, portion_key: key, price_minor: cents,
});

const noImage = () => null;

// Shared catalog pieces
const toppings = group("g-top", "Extra Zutaten", "extra", 0, 6);
const mushrooms = option("o-champ", "g-top", "Champignons", 100);
const salamiTop = option("o-sal", "g-top", "Salami", 100);
const pizzaToppings = attach("a-pizza-top", "category", "c-pizza", "g-top");
const sheetToppings = attach("a-sheet-top", "product", "p-blech", "g-top");

const salami: ProductBundle = {
  product: product("p-salami", "c-pizza", "Salami", { diet: "non_veg" }),
  portions: [
    portion("p-salami", "klein", "Klein 28 cm", 700, { sort_order: 1 }),
    portion("p-salami", "gross", "Groß 32 cm", 900, { sort_order: 2 }),
    portion("p-salami", "maxi", "Maxi 45 cm", 1900, { sort_order: 3 }),
  ],
  categoryAttachments: [pizzaToppings],
  productAttachments: [],
  groups: [toppings],
  options: [mushrooms, salamiTop],
  prices: [
    price("a-pizza-top", "o-champ", "klein", 50), price("a-pizza-top", "o-champ", "gross", 100), price("a-pizza-top", "o-champ", "maxi", 250),
    price("a-pizza-top", "o-sal", "klein", 50), price("a-pizza-top", "o-sal", "gross", 100), price("a-pizza-top", "o-sal", "maxi", 250),
  ],
  tags: [],
};

describe("resolver", () => {
  it("prices an extra per portion, from the category", () => {
    const r = resolveProduct(salami, noImage);
    const champ = r.groups[0].options.find((o) => o.name === "Champignons")!;
    expect(champ.prices).toEqual({ klein: 50, gross: 100, maxi: 250 });
  });

  it("lists portions in order with their prices", () => {
    const r = resolveProduct(salami, noImage);
    expect(r.portions.map((p) => [p.key, p.price_minor])).toEqual([["klein", 700], ["gross", 900], ["maxi", 1900]]);
  });

  it("lets a product attachment replace the category's group, using the product's flat price", () => {
    const sheet: ProductBundle = {
      ...salami,
      product: product("p-blech", "c-bleche", "Pizzablech", {}),
      portions: [portion("p-blech", "standard", "Standard", 2800)],
      categoryAttachments: [attach("a-bleche-cat", "category", "c-bleche", "g-top")],
      productAttachments: [sheetToppings],
      prices: [price("a-sheet-top", "o-champ", null, 250), price("a-sheet-top", "o-sal", null, 250)],
    };
    const r = resolveProduct(sheet, noImage);
    expect(r.groups).toHaveLength(1); // not listed twice
    expect(r.groups[0].options.find((o) => o.name === "Salami")!.prices).toEqual({ standard: 250 });
  });

  it("falls back to the category price where the product sets none", () => {
    const withOverride: ProductBundle = {
      ...salami,
      productAttachments: [attach("a-p", "product", "p-salami", "g-top")],
      prices: [...salami.prices, price("a-p", "o-champ", "maxi", 300)], // only maxi overridden
    };
    const champ = resolveProduct(withOverride, noImage).groups[0].options.find((o) => o.name === "Champignons")!;
    expect(champ.prices).toEqual({ klein: 50, gross: 100, maxi: 300 });
  });

  it("uses the option's own default price when nothing else is set", () => {
    const bare: ProductBundle = { ...salami, prices: [] };
    const champ = resolveProduct(bare, noImage).groups[0].options.find((o) => o.name === "Champignons")!;
    expect(champ.prices).toEqual({ klein: 100, gross: 100, maxi: 100 });
  });

  it("prefers a portion-specific price over an any-portion price", () => {
    const mixed: ProductBundle = {
      ...salami,
      prices: [price("a-pizza-top", "o-champ", null, 80), price("a-pizza-top", "o-champ", "maxi", 250)],
    };
    const champ = resolveProduct(mixed, noImage).groups[0].options.find((o) => o.name === "Champignons")!;
    expect(champ.prices).toEqual({ klein: 80, gross: 80, maxi: 250 });
  });

  it("marks the product's own default option, and leaves choices unpriced", () => {
    const pasta: ProductBundle = {
      product: product("p-bolo", "c-nudeln", "Bolognese", { diet: "non_veg" }),
      portions: [portion("p-bolo", "standard", "Standard", 750)],
      categoryAttachments: [attach("a-nud", "category", "c-nudeln", "g-pasta")],
      productAttachments: [attach("a-bolo", "product", "p-bolo", "g-pasta", { default_option_id: "o-spag" })],
      groups: [group("g-pasta", "Nudelsorte", "choice", 1, 1, true)],
      options: [option("o-rig", "g-pasta", "Rigatoni"), option("o-spag", "g-pasta", "Spaghetti")],
      prices: [],
      tags: [],
    };
    const g = resolveProduct(pasta, noImage).groups[0];
    expect(g.options.find((o) => o.is_default)!.name).toBe("Spaghetti");
    expect(g.options.every((o) => Object.keys(o.prices).length === 0)).toBe(true);
  });

  it("hides inactive groups and options, and groups with no active options", () => {
    const hidden: ProductBundle = {
      ...salami,
      groups: [group("g-top", "Extra Zutaten", "extra", 0, 6, false, false)],
    };
    expect(resolveProduct(hidden, noImage).groups).toHaveLength(0);
    const noOptions: ProductBundle = { ...salami, options: [{ ...mushrooms, is_active: false }, { ...salamiTop, is_active: false }] };
    expect(resolveProduct(noOptions, noImage).groups).toHaveLength(0);
  });

  it("builds the image URL from the stored path", () => {
    const withImage: ProductBundle = { ...salami, product: { ...salami.product, image_path: "p/salami.webp" } };
    expect(resolveProduct(withImage, (p) => (p ? `https://img/${p}` : null)).image_url).toBe("https://img/p/salami.webp");
  });
});

describe("pricing", () => {
  const r = resolveProduct(salami, noImage);
  const champ = r.groups[0].options.find((o) => o.name === "Champignons")!.id;
  const sal = r.groups[0].options.find((o) => o.name === "Salami")!.id;

  it("adds the extras' price for the chosen portion", () => {
    const small = priceSelection(r, { portionKey: "klein", optionIds: [champ, sal], quantity: 1 });
    expect(small).toMatchObject({ ok: true, basePriceMinor: 700, unitPriceMinor: 800 });
    const maxi = priceSelection(r, { portionKey: "maxi", optionIds: [champ, sal], quantity: 2 });
    expect(maxi).toMatchObject({ ok: true, unitPriceMinor: 1900 + 500, totalMinor: (1900 + 500) * 2 });
  });

  it("works with no extras", () => {
    expect(priceSelection(r, { portionKey: "gross", optionIds: [], quantity: 3 })).toMatchObject({ ok: true, totalMinor: 2700 });
  });

  it("refuses unknown portions, options and bad quantities", () => {
    const codes = (s: { portionKey: string; optionIds: string[]; quantity: number }) => validateSelection(r, s).map((i) => i.code);
    expect(codes({ portionKey: "huge", optionIds: [], quantity: 1 })).toContain("PORTION_UNKNOWN");
    expect(codes({ portionKey: "klein", optionIds: ["nope"], quantity: 1 })).toContain("OPTION_UNKNOWN");
    expect(codes({ portionKey: "klein", optionIds: [], quantity: 0 })).toContain("QUANTITY_INVALID");
    expect(codes({ portionKey: "klein", optionIds: [], quantity: 100 })).toContain("QUANTITY_INVALID");
    expect(codes({ portionKey: "klein", optionIds: [champ, champ], quantity: 1 })).toContain("OPTION_DUPLICATE");
  });

  it("enforces group limits", () => {
    expect(validateSelection({ ...r, groups: [{ ...r.groups[0], max: 1 }] }, { portionKey: "klein", optionIds: [champ, sal], quantity: 1 }).map((i) => i.code)).toContain("GROUP_MAX");
  });

  it("requires a choice for a required group", () => {
    const pasta = resolveProduct(
      {
        product: product("p-bolo", "c-nudeln", "Bolognese"),
        portions: [portion("p-bolo", "standard", "Standard", 750)],
        categoryAttachments: [attach("a-nud", "category", "c-nudeln", "g-pasta")],
        productAttachments: [],
        groups: [group("g-pasta", "Nudelsorte", "choice", 1, 1, true)],
        options: [option("o-rig", "g-pasta", "Rigatoni"), option("o-spag", "g-pasta", "Spaghetti")],
        prices: [],
        tags: [],
      },
      noImage,
    );
    expect(validateSelection(pasta, { portionKey: "standard", optionIds: [], quantity: 1 }).map((i) => i.code)).toContain("GROUP_MIN");
    expect(validateSelection(pasta, { portionKey: "standard", optionIds: ["o-rig", "o-spag"], quantity: 1 }).map((i) => i.code)).toContain("GROUP_MAX");
    expect(priceSelection(pasta, { portionKey: "standard", optionIds: ["o-spag"], quantity: 2 })).toMatchObject({ ok: true, totalMinor: 1500 });
  });

  it("refuses an unavailable portion and pickup-only items for delivery", () => {
    const sold = { ...r, portions: r.portions.map((p) => (p.key === "klein" ? { ...p, available: false } : p)) };
    expect(validateSelection(sold, { portionKey: "klein", optionIds: [], quantity: 1 }).map((i) => i.code)).toContain("PORTION_UNAVAILABLE");
    const beer = { ...r, fulfillment: "pickup_only" as const };
    expect(validateSelection(beer, { portionKey: "klein", optionIds: [], quantity: 1 }).map((i) => i.code)).toContain("PICKUP_ONLY");
    expect(validateSelection(beer, { portionKey: "klein", optionIds: [], quantity: 1 }, { forDelivery: false })).toHaveLength(0);
  });

  it("never trusts a price sent by the client: the result depends only on ids and quantity", () => {
    const withBogus = { portionKey: "klein", optionIds: [champ], quantity: 1, price: 1 } as unknown as { portionKey: string; optionIds: string[]; quantity: number };
    expect(priceSelection(r, withBogus)).toMatchObject({ ok: true, unitPriceMinor: 750 });
  });
});
