import { z } from "zod";
import { SLUG_PATTERN } from "./slug";

// Request bodies for the admin catalog API. Snake_case, like the public API. Money is whole minor units (cents).

const id = z.string().uuid();
const name = z.string().trim().min(1, "Name is required.").max(120);
const slug = z.string().min(1).max(60).regex(SLUG_PATTERN, "Use lowercase letters, digits and single hyphens.");
const key = z.string().min(1).max(30).regex(/^[a-z0-9_]+$/, "Use lowercase letters, digits and underscores.");
const cents = z.number().int("Price must be whole cents.").min(0, "Price cannot be negative.").max(10_000_000);
export const imagePath = z.string().min(1).max(300).regex(/^[A-Za-z0-9/_.-]+$/, "Invalid image path.").refine((p) => !p.includes(".."), "Invalid image path.");

// Create and update share the same fields, but only create fills in defaults. An update must change nothing it was not asked
// to change: with defaults applied, PATCH {"name":"x"} would also reset the description, image and visibility.
const categoryFields = {
  name,
  slug,
  description: z.string().trim().max(1000),
  parent_id: id.nullable(),
  image_path: imagePath.nullable(),
  icon_key: z.string().max(40).regex(/^[a-z0-9_]+$/).nullable(),
  default_portion_set_id: id.nullable(),
  is_active: z.boolean(),
};

export const categoryCreate = z.object({
  name: categoryFields.name,
  slug: categoryFields.slug.optional(),
  description: categoryFields.description.default(""),
  parent_id: categoryFields.parent_id.default(null),
  image_path: categoryFields.image_path.default(null),
  icon_key: categoryFields.icon_key.default(null),
  default_portion_set_id: categoryFields.default_portion_set_id.default(null),
  is_active: categoryFields.is_active.default(true),
});

export const categoryUpdate = z.object(categoryFields).partial().refine((v) => Object.keys(v).length > 0, "Nothing to update.");

export const reorder = z.object({ ids: z.array(id).min(1).max(500) }).refine((v) => new Set(v.ids).size === v.ids.length, "Each id can appear once.");

export const portion = z.object({
  key,
  label: z.string().trim().min(1).max(40),
  price_minor: cents,
  is_available: z.boolean().default(true),
  sku: z.string().trim().max(60).nullable().default(null),
});

const portions = z.array(portion).min(1, "A product needs at least one portion.").max(12)
  .refine((list) => new Set(list.map((p) => p.key)).size === list.length, "Portion keys must be different.");

const productFields = {
  category_id: id,
  name,
  slug,
  description: z.string().trim().max(1000),
  image_path: imagePath.nullable(),
  diet: z.enum(["veg", "non_veg"]),
  is_spicy: z.boolean(),
  is_bestseller: z.boolean(),
  is_new: z.boolean(),
  allergens: z.array(z.string().trim().min(1).max(8)).max(20),
  fulfillment: z.enum(["delivery_and_pickup", "pickup_only"]),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(100000),
  tag_keys: z.array(key).max(20),
};

export const productCreate = z.object({
  category_id: productFields.category_id,
  name: productFields.name,
  slug: productFields.slug.optional(),
  description: productFields.description.default(""),
  image_path: productFields.image_path.default(null),
  diet: productFields.diet,
  is_spicy: productFields.is_spicy.default(false),
  is_bestseller: productFields.is_bestseller.default(false),
  is_new: productFields.is_new.default(false),
  allergens: productFields.allergens.default([]),
  fulfillment: productFields.fulfillment.default("delivery_and_pickup"),
  is_active: productFields.is_active.default(true),
  sort_order: productFields.sort_order.optional(),
  portions,
  tag_keys: productFields.tag_keys.default([]),
});

/** Portions, when given, replace the whole list (a product always keeps at least one). */
export const productUpdate = z.object({ ...productFields, portions }).partial().refine((v) => Object.keys(v).length > 0, "Nothing to update.");

export const availability = z.object({
  is_active: z.boolean().optional(),
  portion_key: key.optional(),
  is_available: z.boolean().optional(),
}).refine((v) => v.is_active !== undefined || (v.portion_key !== undefined && v.is_available !== undefined), "Say what to change.");

export const groupCreate = z.object({
  name,
  kind: z.enum(["extra", "choice"]),
  min_select: z.number().int().min(0).max(50).default(0),
  max_select: z.number().int().min(1).max(50).default(1),
  is_required: z.boolean().default(false),
  is_active: z.boolean().default(true),
}).superRefine((g, ctx) => {
  if (g.max_select < g.min_select) ctx.addIssue({ code: "custom", message: "The maximum cannot be below the minimum.", path: ["max_select"] });
  if (g.is_required && g.min_select < 1) ctx.addIssue({ code: "custom", message: "A required group needs a minimum of at least 1.", path: ["min_select"] });
});

// `kind` is fixed once a group exists: turning an extra into a free choice would silently drop its prices.
export const groupUpdate = z.object({
  name: name.optional(),
  min_select: z.number().int().min(0).max(50).optional(),
  max_select: z.number().int().min(1).max(50).optional(),
  is_required: z.boolean().optional(),
  is_active: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, "Nothing to update.");

export const optionsReplace = z.object({
  options: z.array(z.object({
    id: id.optional(),
    name,
    default_price_minor: cents.default(0),
    is_active: z.boolean().default(true),
  })).max(200),
}).refine((v) => new Set(v.options.map((o) => o.name.toLowerCase())).size === v.options.length, "Option names must be different.");

export const attachmentSet = z.object({
  scope: z.enum(["category", "product"]),
  target_id: id,
  group_id: id,
  sort_order: z.number().int().min(0).max(1000).default(0),
  default_option_id: id.nullable().default(null),
  /** When present, replaces every price row of this attachment. Omit it to leave the prices as they are. */
  prices: z.array(z.object({ option_id: id, portion_key: key.nullable(), price_minor: cents })).max(5000).optional(),
});

export const uploadRequest = z.object({
  kind: z.enum(["product", "category", "promotion"]),
  content_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export type CategoryCreate = z.infer<typeof categoryCreate>;
export type CategoryUpdate = z.infer<typeof categoryUpdate>;
export type ProductCreate = z.infer<typeof productCreate>;
export type ProductUpdate = z.infer<typeof productUpdate>;
export type GroupCreate = z.infer<typeof groupCreate>;
export type GroupUpdate = z.infer<typeof groupUpdate>;
export type AttachmentSet = z.infer<typeof attachmentSet>;
