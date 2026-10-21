// Browser-side client for the admin catalog API (/api/admin/*). Same-origin, so the dashboard's session cookie goes along.
// Every failure is an ApiError with the server's code and a message that is safe to show.

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/admin${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Can't reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // not JSON
  }
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } } | null)?.error;
    if (res.status === 401) throw new ApiError(401, "UNAUTHENTICATED", "Your session has expired. Sign in again.");
    throw new ApiError(res.status, err?.code ?? "ERROR", err?.message ?? "Something went wrong. Please try again.");
  }
  return json as T;
}

// ---- Shapes -----------------------------------------------------------------------------------------------------------
export interface CategoryAdmin {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  description: string;
  image_path: string | null;
  image_url: string | null;
  thumb_url: string | null;
  icon_key: string | null;
  sort_order: number;
  is_active: boolean;
  default_portion_set_id: string | null;
  product_count: number;
}

export interface CategoryInput {
  name: string;
  description: string;
  parent_id: string | null;
  image_path: string | null;
  default_portion_set_id: string | null;
  is_active: boolean;
}

export interface PortionSet {
  id: string;
  name: string;
  items: { key: string; label: string; sort_order: number }[];
}

export interface OptionGroupSummary {
  id: string;
  name: string;
  kind: "extra" | "choice";
  is_active: boolean;
  option_count: number;
  attachment_count: number;
}

export interface AttachmentAdmin {
  id: string;
  scope: "category" | "product";
  group_id: string;
  sort_order: number;
  default_option_id: string | null;
}

export interface PortionAdmin {
  key: string;
  label: string;
  price_minor: number;
  is_available: boolean;
  sku: string | null;
}

export interface ProductSummary {
  id: string;
  category_id: string;
  name: string;
  description: string;
  image_url: string | null;
  thumb_url: string | null;
  diet: "veg" | "non_veg";
  is_spicy: boolean;
  is_bestseller: boolean;
  is_new: boolean;
  fulfillment: "delivery_and_pickup" | "pickup_only";
  is_active: boolean;
  sort_order: number;
  portions: Pick<PortionAdmin, "key" | "label" | "price_minor" | "is_available">[];
}

export interface ProductFields {
  category_id: string;
  name: string;
  description: string;
  image_path: string | null;
  diet: "veg" | "non_veg";
  is_spicy: boolean;
  is_bestseller: boolean;
  is_new: boolean;
  fulfillment: "delivery_and_pickup" | "pickup_only";
  is_active: boolean;
}

export interface PriceRowAdmin {
  attachment_id?: string;
  option_id: string;
  portion_key: string | null;
  price_minor: number;
}

export interface AttachmentWithPrices extends AttachmentAdmin {
  prices: PriceRowAdmin[];
}

export interface ProductDetail {
  product: ProductFields & { id: string; slug: string; image_url: string | null; thumb_url: string | null };
  portions: PortionAdmin[];
  tag_keys: string[];
  attachments: AttachmentWithPrices[];
  inherited_attachments: AttachmentWithPrices[];
}

export interface OptionAdmin {
  id: string;
  group_id: string;
  name: string;
  default_price_minor: number;
  sort_order: number;
  is_active: boolean;
}

export interface GroupDetail {
  id: string;
  name: string;
  kind: "extra" | "choice";
  min_select: number;
  max_select: number;
  is_required: boolean;
  is_active: boolean;
  options: OptionAdmin[];
}

export interface GroupInput {
  name: string;
  kind: "extra" | "choice";
  min_select: number;
  max_select: number;
  is_required: boolean;
  is_active: boolean;
}

export interface OptionInput {
  id?: string;
  name: string;
  default_price_minor: number;
  is_active: boolean;
}

export interface UploadTicket {
  path: string;
  upload_url: string;
  token: string;
  public_url: string | null;
  max_bytes: number;
}

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// ---- Calls ------------------------------------------------------------------------------------------------------------
// ---- Orders (the restaurant side of checkout) ---------------------------------------------------------------------------------
export interface OrderAdmin {
  id: string;
  number: string;
  status: string;
  total_minor: number;
  currency: string;
  created_at: string;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  delivery_fee_minor: number;
  coupon_code: string | null;
  payment_method: string;
  payment_status: string;
  estimated_minutes: number | null;
  delivery_address: string;
  delivery: { label: string; line1: string; locality: string; city: string; postal_code: string; instructions: string | null };
  lines: { name: string; portion: string; options: string[]; quantity: number; unit_price_minor: number; line_total_minor: number }[];
  history: { status: string; at: string; reason: string | null; actor: string }[];
}

export const adminApi = {
  orders: {
    /** Newest first. The server allows up to 200 per request. */
    list: (limit = 200) => request<{ items: OrderAdmin[]; has_more: boolean }>("GET", `/orders?limit=${limit}`),
    /** Moves an order along its lifecycle. The server refuses a move the lifecycle does not allow (409 INVALID_TRANSITION). */
    setStatus: (id: string, status: string, reason?: string) => request<OrderAdmin>("PATCH", `/orders/${id}/status`, { status, reason }),
  },
  categories: {
    list: () => request<{ items: CategoryAdmin[] }>("GET", "/categories").then((r) => r.items),
    create: (input: CategoryInput) => request<CategoryAdmin>("POST", "/categories", input),
    update: (id: string, patch: Partial<CategoryInput>) => request<CategoryAdmin>("PATCH", `/categories/${id}`, patch),
    remove: (id: string) => request<void>("DELETE", `/categories/${id}`),
    reorder: (ids: string[]) => request<{ ok: true }>("POST", "/categories/reorder", { ids }),
  },
  portionSets: {
    list: () => request<{ items: PortionSet[] }>("GET", "/portion-sets").then((r) => r.items),
  },
  groups: {
    list: () => request<{ items: OptionGroupSummary[] }>("GET", "/option-groups").then((r) => r.items),
    get: (id: string) => request<GroupDetail>("GET", `/option-groups/${id}`),
    create: (input: GroupInput) => request<GroupDetail>("POST", "/option-groups", input),
    update: (id: string, patch: Partial<Omit<GroupInput, "kind">>) => request<GroupDetail>("PATCH", `/option-groups/${id}`, patch),
    remove: (id: string) => request<void>("DELETE", `/option-groups/${id}`),
    replaceOptions: (id: string, options: OptionInput[]) => request<GroupDetail>("PUT", `/option-groups/${id}/options`, { options }),
  },
  attachments: {
    forCategory: (categoryId: string) =>
      request<{ items: AttachmentAdmin[] }>("GET", `/attachments?scope=category&target_id=${categoryId}`).then((r) => r.items),
    attachToCategory: (categoryId: string, groupId: string, sortOrder: number) =>
      request<AttachmentAdmin>("PUT", "/attachments", { scope: "category", target_id: categoryId, group_id: groupId, sort_order: sortOrder }),
    remove: (id: string) => request<void>("DELETE", `/attachments/${id}`),
    forProduct: (productId: string) =>
      request<{ items: AttachmentWithPrices[] }>("GET", `/attachments?scope=product&target_id=${productId}`).then((r) => r.items),
    forCategoryWithPrices: (categoryId: string) =>
      request<{ items: AttachmentWithPrices[] }>("GET", `/attachments?scope=category&target_id=${categoryId}`).then((r) => r.items),
    /** Creates or updates one attachment. `prices`, when given, replaces its whole price grid; leave it out to keep the prices. */
    set: (input: {
      scope: "category" | "product";
      target_id: string;
      group_id: string;
      sort_order: number;
      default_option_id: string | null;
      prices?: { option_id: string; portion_key: string | null; price_minor: number }[];
    }) => request<AttachmentWithPrices>("PUT", "/attachments", input),
  },
  products: {
    list: (q: { category?: string; search?: string; active?: boolean; offset?: number; limit?: number }) => {
      const params = new URLSearchParams();
      if (q.category) params.set("category", q.category);
      if (q.search) params.set("search", q.search);
      if (q.active !== undefined) params.set("active", String(q.active));
      params.set("offset", String(q.offset ?? 0));
      params.set("limit", String(q.limit ?? 50));
      return request<{ items: ProductSummary[]; has_more: boolean }>("GET", `/products?${params}`);
    },
    get: (id: string) => request<ProductDetail>("GET", `/products/${id}`),
    create: (input: ProductFields & { portions: Omit<PortionAdmin, "sku">[] }) => request<ProductDetail>("POST", "/products", input),
    update: (id: string, patch: Partial<ProductFields> & { portions?: Omit<PortionAdmin, "sku">[] }) => request<ProductDetail>("PATCH", `/products/${id}`, patch),
    availability: (id: string, body: { is_active?: boolean; portion_key?: string; is_available?: boolean }) => request<ProductDetail>("PATCH", `/products/${id}/availability`, body),
    duplicate: (id: string) => request<ProductDetail>("POST", `/products/${id}/duplicate`),
  },
  uploads: {
    ticket: (kind: "product" | "category", contentType: string) => request<UploadTicket>("POST", "/uploads", { kind, content_type: contentType }),
  },
};

/** Checks a picked file before any upload starts. Returns a message to show, or null when the file is fine. */
export function imageProblem(file: { type: string; size: number }): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return "Use a JPG, PNG or WebP image.";
  if (file.size > MAX_IMAGE_BYTES) return "The image is larger than 5 MB. Choose a smaller one.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

/** Uploads a picked image straight to storage and returns the path to save on the category or product, plus a URL to preview it. */
export async function uploadImage(kind: "product" | "category", file: File): Promise<{ path: string; url: string | null }> {
  const problem = imageProblem(file);
  if (problem) throw new ApiError(400, "IMAGE_INVALID", problem);
  const ticket = await adminApi.uploads.ticket(kind, file.type);
  let res: Response;
  try {
    res = await fetch(ticket.upload_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  } catch {
    throw new ApiError(0, "NETWORK", "The image could not be uploaded. Check your connection and try again.");
  }
  if (!res.ok) throw new ApiError(res.status, "UPLOAD_FAILED", "The image could not be uploaded. Try a different file.");
  return { path: ticket.path, url: ticket.public_url };
}
