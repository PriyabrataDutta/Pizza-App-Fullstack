// Catalog types. Row types mirror the tables in supabase/migrations/20261019100000_catalog.sql.
// Resolved types are what the API sends: every inheritance and price rule is already applied, so a client only displays them.

export type Diet = "veg" | "non_veg";
export type GroupKind = "extra" | "choice";
export type Fulfillment = "delivery_and_pickup" | "pickup_only";

export interface CategoryRow {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  description: string;
  image_path: string | null;
  icon_key: string | null;
  sort_order: number;
  is_active: boolean;
  default_portion_set_id: string | null;
}

export interface ProductRow {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  description: string;
  image_path: string | null;
  diet: Diet;
  is_spicy: boolean;
  is_bestseller: boolean;
  is_new: boolean;
  allergens: string[];
  fulfillment: Fulfillment;
  sort_order: number;
  is_active: boolean;
}

export interface PortionRow {
  product_id: string;
  key: string;
  label: string;
  price_minor: number;
  currency: string;
  sku: string | null;
  is_available: boolean;
  sort_order: number;
}

export interface GroupRow {
  id: string;
  name: string;
  kind: GroupKind;
  min_select: number;
  max_select: number;
  is_required: boolean;
  is_active: boolean;
}

export interface OptionRow {
  id: string;
  group_id: string;
  name: string;
  default_price_minor: number;
  sort_order: number;
  is_active: boolean;
}

export interface AttachmentRow {
  id: string;
  scope: "category" | "product";
  category_id: string | null;
  product_id: string | null;
  group_id: string;
  sort_order: number;
  default_option_id: string | null;
}

export interface OptionPriceRow {
  attachment_id: string;
  option_id: string;
  /** null means "any portion". */
  portion_key: string | null;
  price_minor: number;
}

export interface TagRow {
  key: string;
  label: string;
  sort_order: number;
}

/** Everything needed to resolve one product, already loaded. */
export interface ProductBundle {
  product: ProductRow;
  portions: PortionRow[];
  /** Attachments on the product's category. */
  categoryAttachments: AttachmentRow[];
  /** Attachments on the product itself. */
  productAttachments: AttachmentRow[];
  groups: GroupRow[];
  options: OptionRow[];
  prices: OptionPriceRow[];
  tags: string[];
}

// ---- Resolved (API) shapes -------------------------------------------------------------------------------------------

export interface ResolvedPortion {
  key: string;
  label: string;
  price_minor: number;
  available: boolean;
}

export interface ResolvedOption {
  id: string;
  name: string;
  /** True for the option preselected for this product (for example the pasta a dish comes with). */
  is_default: boolean;
  /** Extra price by portion key, in minor units. Empty for free choices. */
  prices: Record<string, number>;
}

export interface ResolvedGroup {
  id: string;
  name: string;
  kind: GroupKind;
  min: number;
  max: number;
  required: boolean;
  options: ResolvedOption[];
}

export interface ResolvedProduct {
  id: string;
  category_id: string;
  name: string;
  description: string;
  image_url: string | null;
  /** Small copy for lists and cards. */
  thumb_url: string | null;
  diet: Diet;
  is_spicy: boolean;
  is_bestseller: boolean;
  is_new: boolean;
  allergens: string[];
  fulfillment: Fulfillment;
  tags: string[];
  currency: string;
  portions: ResolvedPortion[];
  groups: ResolvedGroup[];
}
