// Offer banners on the app's Home screen. Pure rules: which banners are showing now, and what the app receives.

export interface PromotionRow {
  id: string;
  title: string;
  detail: string;
  coupon_code: string | null;
  image_path: string | null;
  sort_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at?: string;
}

/** Visible to customers: switched on, started, and not ended. A banner with no dates always shows. */
export function isLive(p: Pick<PromotionRow, "is_active" | "starts_at" | "ends_at">, now: Date): boolean {
  if (!p.is_active) return false;
  const t = now.getTime();
  if (p.starts_at && new Date(p.starts_at).getTime() > t) return false;
  if (p.ends_at && new Date(p.ends_at).getTime() <= t) return false;
  return true;
}

export interface PublicPromotion {
  id: string;
  title: string;
  detail: string;
  code: string | null;
  image_url: string | null;
}

/** The banners customers see, in the order the restaurant set. */
export function toPublic(rows: PromotionRow[], now: Date, urlOf: (path: string | null) => string | null): PublicPromotion[] {
  return rows
    .filter((p) => isLive(p, now))
    .sort((a, b) => a.sort_order - b.sort_order || (a.created_at ?? "").localeCompare(b.created_at ?? ""))
    .map((p) => ({ id: p.id, title: p.title, detail: p.detail, code: p.coupon_code, image_url: urlOf(p.image_path) }));
}

/** Where a banner stands, for the dashboard list. */
export type PromotionState = "showing" | "hidden" | "scheduled" | "ended";

export function stateOf(p: Pick<PromotionRow, "is_active" | "starts_at" | "ends_at">, now: Date): PromotionState {
  if (!p.is_active) return "hidden";
  if (p.starts_at && new Date(p.starts_at).getTime() > now.getTime()) return "scheduled";
  if (p.ends_at && new Date(p.ends_at).getTime() <= now.getTime()) return "ended";
  return "showing";
}
