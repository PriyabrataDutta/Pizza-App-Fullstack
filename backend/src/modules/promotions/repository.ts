import "server-only";
import { fromDbError } from "@/modules/catalog/admin/errors";
import { adminClient } from "@/shared/supabase/server";
import type { PromotionRow } from "./domain";

// Storage for the offer banners. No rules here: the service decides, this stores.

const db = () => adminClient();
const COLUMNS = "id, title, detail, coupon_code, image_path, sort_order, is_active, starts_at, ends_at, created_at";

const must = <T>(r: { data: T | null; error: { code?: string; message: string; details?: string | null } | null }, what: string): T => {
  if (r.error) throw fromDbError(r.error, what);
  return r.data as T;
};

/** True when the table does not exist yet (the migration has not been applied). */
export const tableMissing = (error: unknown) => {
  const e = error as { code?: string; message?: string } | null;
  return !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message ?? ""));
};

export const promotions = {
  async all(): Promise<PromotionRow[]> {
    return must(await db().from("promotions").select(COLUMNS).order("sort_order").order("created_at"), "promotions") as PromotionRow[];
  },

  async active(): Promise<PromotionRow[]> {
    const { data, error } = await db().from("promotions").select(COLUMNS).eq("is_active", true).order("sort_order").order("created_at");
    if (error) {
      if (tableMissing(error)) return []; // before the migration there are simply no banners
      throw new Error(`promotions: ${error.message}`);
    }
    return data as PromotionRow[];
  },

  async get(id: string): Promise<PromotionRow | null> {
    return (must(await db().from("promotions").select(COLUMNS).eq("id", id).maybeSingle(), "promotion") as PromotionRow | null) ?? null;
  },

  async nextSort(): Promise<number> {
    const rows = must(await db().from("promotions").select("sort_order").order("sort_order", { ascending: false }).limit(1), "promotion order") as { sort_order: number }[];
    return (rows[0]?.sort_order ?? 0) + 1;
  },

  async insert(row: Omit<PromotionRow, "id" | "created_at">): Promise<PromotionRow> {
    return must(await db().from("promotions").insert(row).select(COLUMNS).single(), "create promotion") as PromotionRow;
  },

  async update(id: string, patch: Partial<Omit<PromotionRow, "id" | "created_at">>): Promise<PromotionRow> {
    return must(await db().from("promotions").update(patch).eq("id", id).select(COLUMNS).single(), "update promotion") as PromotionRow;
  },

  async remove(id: string): Promise<void> {
    must(await db().from("promotions").delete().eq("id", id), "delete promotion");
  },

  async setOrder(ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) must(await db().from("promotions").update({ sort_order: i + 1 }).eq("id", ids[i]), "reorder promotions");
  },
};
