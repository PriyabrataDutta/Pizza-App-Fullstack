import "server-only";
import { randomUUID } from "node:crypto";
import { writeAudit } from "@/modules/access/repository";
import { supabaseCatalogRepository as publicRepo } from "../repository";
import { resolveProduct } from "../resolver";
import type { ProductBundle, ResolvedProduct } from "../types";
import { AdminError } from "./errors";
import { attachments, categories, groups, portionSets, products, storage } from "./repository";
import type { AttachmentSet, CategoryCreate, CategoryUpdate, GroupCreate, GroupUpdate, ProductCreate, ProductUpdate } from "./schemas";
import { slugify, uniqueSlug } from "./slug";

// Use cases for the dashboard's menu management. Every change is checked here first, stored through ./repository, and written
// to the audit log. Nothing is ever hard-deleted that an order could refer to: products are hidden, not deleted.

export interface Actor { id: string; email: string }

const audit = (actor: Actor, action: string, targetId: string, details: Record<string, unknown> = {}) =>
  writeAudit({ actorId: actor.id, actorEmail: actor.email, action, targetId, details });

const compact = <T extends Record<string, unknown>>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

export function publicImageUrl(path: string | null): string | null {
  const base = process.env.SUPABASE_URL;
  if (!path || !base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/product-images/${path.split("/").map(encodeURIComponent).join("/")}`;
}

// ---- Portion templates --------------------------------------------------------------------------------------------------
export const listPortionSets = () => portionSets.all();

// ---- Categories -------------------------------------------------------------------------------------------------------
export async function listCategories() {
  return (await categories.all()).map((c) => ({ ...c, image_url: publicImageUrl(c.image_path) }));
}

export async function createCategory(actor: Actor, input: CategoryCreate) {
  if (input.parent_id && !(await categories.get(input.parent_id))) throw new AdminError("NOT_FOUND", "The parent category does not exist.");
  const taken = await categories.slugs();
  if (input.slug && taken.has(input.slug)) throw new AdminError("SLUG_TAKEN", "That web address (slug) is already used. Pick another one.");
  const slug = input.slug ?? uniqueSlug(slugify(input.name), taken);
  const row = await categories.insert({
    slug, name: input.name, description: input.description, parent_id: input.parent_id, image_path: input.image_path, icon_key: input.icon_key,
    default_portion_set_id: input.default_portion_set_id, is_active: input.is_active, sort_order: await categories.nextSort(input.parent_id),
  });
  await audit(actor, "category_created", row.id, { name: row.name });
  return { ...row, image_url: publicImageUrl(row.image_path) };
}

export async function updateCategory(actor: Actor, id: string, patch: CategoryUpdate) {
  if (!(await categories.get(id))) throw new AdminError("NOT_FOUND", "That category does not exist.");
  if (patch.parent_id && patch.parent_id === id) throw new AdminError("CATEGORY_DEPTH", "A category cannot be its own parent.");
  const row = await categories.update(id, compact({ ...patch }));
  await audit(actor, "category_updated", id, { fields: Object.keys(patch) });
  return { ...row, image_url: publicImageUrl(row.image_path) };
}

export async function deleteCategory(actor: Actor, id: string) {
  const category = await categories.get(id);
  if (!category) throw new AdminError("NOT_FOUND", "That category does not exist.");
  const [children, productCount] = await Promise.all([categories.childCount(id), categories.productCount(id)]);
  if (children > 0 || productCount > 0) {
    throw new AdminError("CATEGORY_NOT_EMPTY", `This category still has ${productCount} product(s) and ${children} sub-categor${children === 1 ? "y" : "ies"}. Move them or hide the category instead.`);
  }
  await categories.remove(id);
  await audit(actor, "category_deleted", id, { name: category.name });
}

export async function reorderCategories(actor: Actor, ids: string[]) {
  const known = await categories.existingIds(ids);
  if (ids.some((id) => !known.has(id))) throw new AdminError("NOT_FOUND", "One of the categories does not exist.");
  const parents = new Set((await Promise.all(ids.map((id) => categories.get(id)))).map((c) => c?.parent_id ?? null));
  if (parents.size > 1) throw new AdminError("VALIDATION_ERROR", "Only categories with the same parent can be reordered together.");
  await Promise.all(ids.map((id, i) => categories.setSort(id, i + 1)));
  await audit(actor, "categories_reordered", ids[0], { count: ids.length });
}

// ---- Products ---------------------------------------------------------------------------------------------------------
export async function listProducts(filter: { categoryId?: string; search?: string; active?: boolean; offset: number; limit: number }) {
  const page = await products.page(filter);
  const portions = await products.portionsFor(page.rows.map((p) => p.id));
  return {
    items: page.rows.map((p) => ({
      ...p,
      image_url: publicImageUrl(p.image_path),
      portions: portions.filter((x) => x.product_id === p.id).map((x) => ({ key: x.key, label: x.label, price_minor: x.price_minor, is_available: x.is_available })),
    })),
    has_more: page.hasMore,
  };
}

/** Everything the product editor needs: the product, its portions and tags, its own group attachments, and those inherited from the category. */
export async function getProductForEditing(id: string) {
  const product = await products.get(id);
  if (!product) throw new AdminError("NOT_FOUND", "That product does not exist.");
  const [portions, tagKeys, own, inherited] = await Promise.all([
    products.portions(id), products.tagKeys(id), attachments.forTarget("product", id), attachments.forTarget("category", product.category_id),
  ]);
  return { product: { ...product, image_url: publicImageUrl(product.image_path) }, portions, tag_keys: tagKeys, attachments: own, inherited_attachments: inherited };
}

/** The product as a customer would see it, including hidden products, so an editor can preview before publishing. */
export async function previewProduct(id: string): Promise<ResolvedProduct> {
  const product = await products.get(id);
  if (!product) throw new AdminError("NOT_FOUND", "That product does not exist.");
  const [portions, attached, tagMap] = await Promise.all([
    publicRepo.portionsFor([id]),
    publicRepo.attachmentsFor({ categoryIds: [product.category_id], productIds: [id] }),
    publicRepo.tagKeysFor([id]),
  ]);
  const { groups: groupRows, options } = await publicRepo.groupsWithOptions([...new Set(attached.map((a) => a.group_id))]);
  const prices = await publicRepo.pricesFor(attached.map((a) => a.id));
  const bundle: ProductBundle = {
    product, portions,
    categoryAttachments: attached.filter((a) => a.scope === "category"),
    productAttachments: attached.filter((a) => a.scope === "product"),
    groups: groupRows, options, prices, tags: tagMap.get(id) ?? [],
  };
  return resolveProduct(bundle, publicImageUrl);
}

export async function createProduct(actor: Actor, input: ProductCreate) {
  if (!(await categories.get(input.category_id))) throw new AdminError("NOT_FOUND", "The category does not exist.");
  const taken = await products.slugs();
  if (input.slug && taken.has(input.slug)) throw new AdminError("SLUG_TAKEN", "That web address (slug) is already used. Pick another one.");
  const slug = input.slug ?? uniqueSlug(slugify(input.name), taken);

  const row = await products.insert({
    category_id: input.category_id, slug, name: input.name, description: input.description, image_path: input.image_path, diet: input.diet,
    is_spicy: input.is_spicy, is_bestseller: input.is_bestseller, is_new: input.is_new, allergens: input.allergens, fulfillment: input.fulfillment,
    is_active: input.is_active, sort_order: input.sort_order ?? (await products.nextSort(input.category_id)),
  });
  try {
    await products.replacePortions(row.id, input.portions);
    const missing = await products.setTags(row.id, input.tag_keys);
    if (missing.length > 0) throw new AdminError("VALIDATION_ERROR", `Unknown tag(s): ${missing.join(", ")}.`);
  } catch (error) {
    await products.remove(row.id).catch(() => undefined); // do not leave a product with no portions behind
    throw error;
  }
  await audit(actor, "product_created", row.id, { name: row.name, category_id: row.category_id });
  return getProductForEditing(row.id);
}

export async function updateProduct(actor: Actor, id: string, patch: ProductUpdate) {
  if (!(await products.get(id))) throw new AdminError("NOT_FOUND", "That product does not exist.");
  if (patch.category_id && !(await categories.get(patch.category_id))) throw new AdminError("NOT_FOUND", "The category does not exist.");
  const { portions, tag_keys: tagKeys, ...fields } = patch;
  const changed = compact(fields);
  if (Object.keys(changed).length > 0) await products.update(id, changed);
  if (portions) await products.replacePortions(id, portions);
  if (tagKeys) {
    const missing = await products.setTags(id, tagKeys);
    if (missing.length > 0) throw new AdminError("VALIDATION_ERROR", `Unknown tag(s): ${missing.join(", ")}.`);
  }
  await audit(actor, "product_updated", id, { fields: Object.keys(patch) });
  return getProductForEditing(id);
}

export async function setAvailability(actor: Actor, id: string, input: { is_active?: boolean; portion_key?: string; is_available?: boolean }) {
  if (!(await products.get(id))) throw new AdminError("NOT_FOUND", "That product does not exist.");
  if (input.is_active !== undefined) await products.update(id, { is_active: input.is_active });
  if (input.portion_key !== undefined && input.is_available !== undefined) {
    if (!(await products.setPortionAvailable(id, input.portion_key, input.is_available))) throw new AdminError("NOT_FOUND", "That portion does not exist.");
  }
  await audit(actor, "product_availability_changed", id, input);
  return getProductForEditing(id);
}

/** A copy starts hidden, so nothing half-edited goes live by accident. */
export async function duplicateProduct(actor: Actor, id: string) {
  const source = await getProductForEditing(id);
  const taken = await products.slugs();
  const name = `${source.product.name} (copy)`;
  const copy = await products.insert({
    category_id: source.product.category_id, slug: uniqueSlug(slugify(name), taken), name, description: source.product.description,
    image_path: source.product.image_path, diet: source.product.diet, is_spicy: source.product.is_spicy, is_bestseller: false,
    is_new: false, allergens: source.product.allergens, fulfillment: source.product.fulfillment, is_active: false,
    sort_order: await products.nextSort(source.product.category_id),
  });
  try {
    await products.replacePortions(copy.id, source.portions.map((p) => ({ key: p.key, label: p.label, price_minor: p.price_minor, is_available: p.is_available, sku: null })));
    await products.setTags(copy.id, source.tag_keys);
    for (const a of source.attachments) {
      const created = await attachments.upsert({ scope: "product", target_id: copy.id, group_id: a.group_id, sort_order: a.sort_order, default_option_id: a.default_option_id });
      if (a.prices.length > 0) await attachments.replacePrices(created.id, a.prices.map((p) => ({ option_id: p.option_id, portion_key: p.portion_key, price_minor: p.price_minor })));
    }
  } catch (error) {
    await products.remove(copy.id).catch(() => undefined);
    throw error;
  }
  await audit(actor, "product_duplicated", copy.id, { from: id });
  return getProductForEditing(copy.id);
}

// ---- Option groups and options ----------------------------------------------------------------------------------------
export async function listGroups() {
  return groups.all();
}

export async function getGroup(id: string) {
  const group = await groups.get(id);
  if (!group) throw new AdminError("NOT_FOUND", "That group does not exist.");
  return { ...group, options: await groups.options(id) };
}

export async function createGroup(actor: Actor, input: GroupCreate) {
  const row = await groups.insert(input);
  await audit(actor, "group_created", row.id, { name: row.name, kind: row.kind });
  return { ...row, options: [] };
}

export async function updateGroup(actor: Actor, id: string, patch: GroupUpdate) {
  const current = await groups.get(id);
  if (!current) throw new AdminError("NOT_FOUND", "That group does not exist.");
  const min = patch.min_select ?? current.min_select;
  const max = patch.max_select ?? current.max_select;
  const required = patch.is_required ?? current.is_required;
  if (max < min) throw new AdminError("GROUP_RULE_INVALID", "The maximum cannot be below the minimum.");
  if (required && min < 1) throw new AdminError("GROUP_RULE_INVALID", "A required group needs a minimum of at least 1.");
  await groups.update(id, compact({ ...patch }));
  await audit(actor, "group_updated", id, { fields: Object.keys(patch) });
  return getGroup(id);
}

export async function deleteGroup(actor: Actor, id: string) {
  const group = await groups.get(id);
  if (!group) throw new AdminError("NOT_FOUND", "That group does not exist.");
  const used = await groups.attachmentCount(id);
  if (used > 0) throw new AdminError("IN_USE", `This group is used in ${used} place(s). Remove it from those first, or hide it instead.`);
  await groups.remove(id);
  await audit(actor, "group_deleted", id, { name: group.name });
}

/** Replaces the group's options with the given list: ids are kept, new ones created, omitted ones removed. */
export async function replaceOptions(actor: Actor, groupId: string, wanted: { id?: string; name: string; default_price_minor: number; is_active: boolean }[]) {
  const group = await groups.get(groupId);
  if (!group) throw new AdminError("NOT_FOUND", "That group does not exist.");
  if (group.kind === "choice" && wanted.some((o) => o.default_price_minor > 0)) {
    throw new AdminError("CHOICE_PRICE", "Options of a free choice group cannot have a price. Make it an extra group to charge for them.");
  }
  const existing = new Set((await groups.options(groupId)).map((o) => o.id));
  if (wanted.some((o) => o.id && !existing.has(o.id))) throw new AdminError("NOT_FOUND", "One of the options does not belong to this group.");
  const saved = await groups.replaceOptions(groupId, wanted);
  await audit(actor, "options_replaced", groupId, { count: saved.length });
  return { ...group, options: saved };
}

// ---- Where groups apply, and their prices -----------------------------------------------------------------------------
export async function getAttachments(scope: "category" | "product", targetId: string) {
  return attachments.forTarget(scope, targetId);
}

export async function setAttachment(actor: Actor, input: AttachmentSet) {
  const target = input.scope === "category" ? await categories.get(input.target_id) : await products.get(input.target_id);
  if (!target) throw new AdminError("NOT_FOUND", `That ${input.scope} does not exist.`);
  const group = await groups.get(input.group_id);
  if (!group) throw new AdminError("NOT_FOUND", "That group does not exist.");
  const optionIds = new Set((await groups.options(group.id)).map((o) => o.id));

  if (input.default_option_id && !optionIds.has(input.default_option_id)) {
    throw new AdminError("OPTION_NOT_IN_GROUP", "The default option does not belong to this group.");
  }
  if (input.prices) {
    const seen = new Set<string>();
    for (const p of input.prices) {
      if (!optionIds.has(p.option_id)) throw new AdminError("OPTION_NOT_IN_GROUP", "A price refers to an option that is not in this group.");
      const k = `${p.option_id}|${p.portion_key ?? "*"}`;
      if (seen.has(k)) throw new AdminError("DUPLICATE", "The same option has two prices for the same portion.");
      seen.add(k);
      if (group.kind === "choice" && p.price_minor > 0) throw new AdminError("CHOICE_PRICE", "Options of a free choice group cannot have a price.");
    }
  }
  const row = await attachments.upsert({ scope: input.scope, target_id: input.target_id, group_id: input.group_id, sort_order: input.sort_order, default_option_id: input.default_option_id });
  if (input.prices) await attachments.replacePrices(row.id, input.prices);
  await audit(actor, "attachment_set", row.id, { scope: input.scope, target_id: input.target_id, group: group.name, prices: input.prices?.length });
  return (await attachments.forTarget(input.scope, input.target_id)).find((a) => a.id === row.id)!;
}

export async function deleteAttachment(actor: Actor, id: string) {
  const row = await attachments.get(id);
  if (!row) throw new AdminError("NOT_FOUND", "That attachment does not exist.");
  await attachments.remove(id);
  await audit(actor, "attachment_deleted", id, { scope: row.scope, group_id: row.group_id });
}

// ---- Images -----------------------------------------------------------------------------------------------------------
const EXTENSION = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

/**
 * Prepares a direct upload: the browser sends the file to Supabase Storage with the signed URL, then saves `path`
 * on the product or category. The server never handles the file itself, and the bucket enforces the 5 MB and type limits.
 */
export async function createUpload(actor: Actor, kind: "product" | "category", contentType: keyof typeof EXTENSION) {
  const fileId = randomUUID();
  const path = `${kind === "product" ? "products" : "categories"}/${fileId}.${EXTENSION[contentType]}`;
  const { signedUrl, token } = await storage.signedUpload(path);
  await audit(actor, "image_upload_prepared", fileId, { kind, path });
  return { path, upload_url: signedUrl, token, public_url: publicImageUrl(path), max_bytes: 5 * 1024 * 1024 };
}
