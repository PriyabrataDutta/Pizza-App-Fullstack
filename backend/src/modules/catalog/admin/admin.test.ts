import { describe, expect, it } from "vitest";
import { AdminError, fromDbError } from "./errors";
import { isSameOrigin } from "./origin";
import { attachmentSet, availability, categoryCreate, categoryUpdate, groupCreate, optionsReplace, portion, productCreate, productUpdate, reorder, uploadRequest } from "./schemas";
import { slugify, uniqueSlug } from "./slug";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("slugs", () => {
  it("spells out German letters and keeps only safe characters", () => {
    expect(slugify("Pizzabrötchen")).toBe("pizzabroetchen");
    expect(slugify("Indische Süßigkeiten")).toBe("indische-suessigkeiten");
    expect(slugify("  Mix & Match!! ")).toBe("mix-match");
    expect(slugify("Crème brûlée")).toBe("creme-brulee");
    expect(slugify("???")).toBe("");
  });

  it("is never longer than 60 characters and never ends with a hyphen", () => {
    const s = slugify("a".repeat(59) + " b");
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
  });

  it("picks the next free slug", () => {
    expect(uniqueSlug("pizza", new Set())).toBe("pizza");
    expect(uniqueSlug("pizza", new Set(["pizza"]))).toBe("pizza-2");
    expect(uniqueSlug("pizza", new Set(["pizza", "pizza-2", "pizza-3"]))).toBe("pizza-4");
    expect(uniqueSlug("", new Set())).toBe("item");
  });
});

describe("categories", () => {
  it("applies defaults and trims the name", () => {
    const c = categoryCreate.parse({ name: "  Burger " });
    expect(c).toMatchObject({ name: "Burger", is_active: true, parent_id: null, description: "" });
  });

  it("refuses an empty name, a bad slug and a bad image path", () => {
    expect(categoryCreate.safeParse({ name: "  " }).success).toBe(false);
    expect(categoryCreate.safeParse({ name: "x", slug: "Bad Slug" }).success).toBe(false);
    expect(categoryCreate.safeParse({ name: "x", image_path: "../secret" }).success).toBe(false);
    expect(categoryCreate.safeParse({ name: "x", image_path: "categories/a.webp" }).success).toBe(true);
  });

  it("reorders each id once", () => {
    expect(reorder.safeParse({ ids: [uuid(1), uuid(2)] }).success).toBe(true);
    expect(reorder.safeParse({ ids: [uuid(1), uuid(1)] }).success).toBe(false);
    expect(reorder.safeParse({ ids: [] }).success).toBe(false);
  });
});

describe("products", () => {
  const base = { category_id: uuid(1), name: "Margherita", diet: "veg", portions: [{ key: "klein", label: "Klein", price_minor: 550 }] };

  it("needs at least one portion, with whole non-negative cents", () => {
    expect(productCreate.safeParse(base).success).toBe(true);
    expect(productCreate.safeParse({ ...base, portions: [] }).success).toBe(false);
    expect(productCreate.safeParse({ ...base, portions: [{ key: "k", label: "K", price_minor: -1 }] }).success).toBe(false);
    expect(productCreate.safeParse({ ...base, portions: [{ key: "k", label: "K", price_minor: 5.5 }] }).success).toBe(false);
  });

  it("refuses two portions with the same key and a bad portion key", () => {
    const dup = [{ key: "a", label: "A", price_minor: 1 }, { key: "a", label: "B", price_minor: 2 }];
    expect(productCreate.safeParse({ ...base, portions: dup }).success).toBe(false);
    expect(portion.safeParse({ key: "Klein 28", label: "K", price_minor: 1 }).success).toBe(false);
  });

  it("only accepts the known diet and fulfillment values", () => {
    expect(productCreate.safeParse({ ...base, diet: "vegan" }).success).toBe(false);
    expect(productCreate.safeParse({ ...base, fulfillment: "teleport" }).success).toBe(false);
    expect(productCreate.parse(base).fulfillment).toBe("delivery_and_pickup");
  });

  it("an update changes only what it was given, never filling in defaults", () => {
    expect(productUpdate.parse({ name: "Salami" })).toEqual({ name: "Salami" });
    expect(categoryUpdate.parse({ name: "Pizza" })).toEqual({ name: "Pizza" });
    expect(categoryUpdate.parse({ image_path: null })).toEqual({ image_path: null }); // clearing a value is still possible
  });

  it("allows a partial update but not an empty one", () => {
    expect(productUpdate.safeParse({ is_new: true }).success).toBe(true);
    expect(productUpdate.safeParse({}).success).toBe(false);
    expect(productUpdate.safeParse({ portions: [] }).success).toBe(false);
  });

  it("availability needs either a visibility change or a portion and its state", () => {
    expect(availability.safeParse({ is_active: false }).success).toBe(true);
    expect(availability.safeParse({ portion_key: "gross", is_available: false }).success).toBe(true);
    expect(availability.safeParse({ portion_key: "gross" }).success).toBe(false);
    expect(availability.safeParse({}).success).toBe(false);
  });
});

describe("groups and prices", () => {
  it("keeps the minimum, maximum and required flag consistent", () => {
    expect(groupCreate.safeParse({ name: "Dressing", kind: "choice", min_select: 1, max_select: 1, is_required: true }).success).toBe(true);
    expect(groupCreate.safeParse({ name: "X", kind: "extra", min_select: 3, max_select: 2 }).success).toBe(false);
    expect(groupCreate.safeParse({ name: "X", kind: "choice", min_select: 0, max_select: 1, is_required: true }).success).toBe(false);
    expect(groupCreate.safeParse({ name: "X", kind: "other" }).success).toBe(false);
  });

  it("refuses duplicate option names, ignoring case", () => {
    expect(optionsReplace.safeParse({ options: [{ name: "Salami" }, { name: "salami" }] }).success).toBe(false);
    expect(optionsReplace.safeParse({ options: [{ name: "Salami" }, { name: "Schinken", default_price_minor: 100 }] }).success).toBe(true);
  });

  it("accepts a price grid by portion key, with null meaning any portion", () => {
    const grid = [
      { option_id: uuid(5), portion_key: "klein", price_minor: 50 },
      { option_id: uuid(5), portion_key: null, price_minor: 100 },
    ];
    expect(attachmentSet.safeParse({ scope: "category", target_id: uuid(1), group_id: uuid(2), prices: grid }).success).toBe(true);
    expect(attachmentSet.safeParse({ scope: "category", target_id: uuid(1), group_id: uuid(2), prices: [{ option_id: uuid(5), portion_key: "Klein", price_minor: 1 }] }).success).toBe(false);
    expect(attachmentSet.safeParse({ scope: "shelf", target_id: uuid(1), group_id: uuid(2) }).success).toBe(false);
  });

  it("limits uploads to the three image types", () => {
    expect(uploadRequest.safeParse({ kind: "product", content_type: "image/webp" }).success).toBe(true);
    expect(uploadRequest.safeParse({ kind: "product", content_type: "image/svg+xml" }).success).toBe(false);
    expect(uploadRequest.safeParse({ kind: "user", content_type: "image/png" }).success).toBe(false);
  });
});

describe("database error mapping", () => {
  it("explains duplicates, slugs, references and the migration's own rules", () => {
    const slug = fromDbError({ code: "23505", message: 'duplicate key value violates unique constraint "products_slug_key"' }, "create product");
    expect(slug).toBeInstanceOf(AdminError);
    expect((slug as AdminError).code).toBe("SLUG_TAKEN");
    expect((fromDbError({ code: "23505", message: "duplicate key" }, "x") as AdminError).code).toBe("DUPLICATE");
    expect((fromDbError({ code: "23503", message: "violates foreign key" }, "x") as AdminError).code).toBe("IN_USE");
    const depth = fromDbError({ code: "P0001", message: "CATEGORY_DEPTH: categories can be nested one level only" }, "x") as AdminError;
    expect(depth.code).toBe("CATEGORY_DEPTH");
    expect(depth.message).toBe("categories can be nested one level only");
    expect((fromDbError({ code: "P0001", message: "CHOICE_PRICE: options of a choice group must be free" }, "x") as AdminError).status).toBe(400);
  });

  it("returns a plain error for anything unknown, so the route reports a 500 without details", () => {
    const e = fromDbError({ code: "XX000", message: "connection reset" }, "save");
    expect(e).not.toBeInstanceOf(AdminError);
  });
});

describe("cross-site protection", () => {
  const req = (headers: Record<string, string>) => ({ headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } });

  it("accepts the dashboard's own origin and refuses another site", () => {
    expect(isSameOrigin(req({ origin: "https://admin.example.com", host: "admin.example.com" }))).toBe(true);
    expect(isSameOrigin(req({ origin: "https://evil.example", host: "admin.example.com" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "not a url", host: "admin.example.com" }))).toBe(false);
  });

  it("without an Origin it relies on Sec-Fetch-Site, and allows plain scripts that send neither", () => {
    expect(isSameOrigin(req({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOrigin(req({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOrigin(req({}))).toBe(true);
  });
});
