import "server-only";
import { adminClient } from "@/shared/supabase/server";
import type { OpeningHour, RestaurantSettings } from "./domain";
import type { SettingsRepository } from "./service";

const db = () => adminClient();

export const supabaseSettingsRepository: SettingsRepository = {
  async load() {
    const [s, h] = await Promise.all([
      db().from("restaurant_settings").select("*").eq("id", 1).single(),
      db().from("opening_hours").select("weekday, opens_at, closes_at"),
    ]);
    if (s.error) throw new Error(`settings: ${s.error.message}`);
    if (h.error) throw new Error(`opening hours: ${h.error.message}`);
    const r = s.data as {
      name: string; time_zone: string; accepting_orders: boolean; closed_message: string; extra_prep_minutes: number;
      enforce_opening_hours: boolean; require_contact_details: boolean;
    };
    const settings: RestaurantSettings = {
      name: r.name, timeZone: r.time_zone, acceptingOrders: r.accepting_orders, closedMessage: r.closed_message,
      extraPrepMinutes: r.extra_prep_minutes, enforceOpeningHours: r.enforce_opening_hours, requireContactDetails: r.require_contact_details,
    };
    const hours = (h.data as { weekday: number; opens_at: string; closes_at: string }[]).map((x) => ({ weekday: x.weekday, opensAt: x.opens_at, closesAt: x.closes_at }));
    return { settings, hours };
  },

  async save(patch) {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.acceptingOrders !== undefined) row.accepting_orders = patch.acceptingOrders;
    if (patch.closedMessage !== undefined) row.closed_message = patch.closedMessage;
    if (patch.extraPrepMinutes !== undefined) row.extra_prep_minutes = patch.extraPrepMinutes;
    if (patch.enforceOpeningHours !== undefined) row.enforce_opening_hours = patch.enforceOpeningHours;
    if (patch.requireContactDetails !== undefined) row.require_contact_details = patch.requireContactDetails;
    const { error } = await db().from("restaurant_settings").update(row).eq("id", 1);
    if (error) throw new Error(`save settings: ${error.message}`);
  },

  async replaceHours(hours: OpeningHour[]) {
    const del = await db().from("opening_hours").delete().gte("weekday", 1);
    if (del.error) throw new Error(`clear opening hours: ${del.error.message}`);
    if (hours.length === 0) return;
    const ins = await db().from("opening_hours").insert(hours.map((h) => ({ weekday: h.weekday, opens_at: h.opensAt, closes_at: h.closesAt })));
    if (ins.error) throw new Error(`save opening hours: ${ins.error.message}`);
  },
};
