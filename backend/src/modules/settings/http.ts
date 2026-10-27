import "server-only";
import { createSettingsService } from "./service";
import { supabaseSettingsRepository } from "./repository";
import type { OpeningHour, RestaurantSettings } from "./domain";
import type { SettingsUpdate } from "./schemas";

/** One service per server instance, so its short cache is shared by checkout and the dashboard. */
export const settings = createSettingsService({ repo: supabaseSettingsRepository });

const hoursDto = (hours: OpeningHour[]) => hours.map((h) => ({ weekday: h.weekday, opens_at: h.opensAt, closes_at: h.closesAt }));

/** What customers (the app) may know. */
export async function publicRestaurant() {
  const { settings: s, hours, status } = await settings.get();
  return {
    name: s.name, open: status.open, closed_reason: status.reason, message: status.message,
    opening_hours: s.enforceOpeningHours ? hoursDto(hours) : [], time_zone: s.timeZone, require_contact_details: s.requireContactDetails,
  };
}

/** What the dashboard edits. */
export async function adminRestaurant() {
  const { settings: s, hours, status } = await settings.get();
  return {
    name: s.name, time_zone: s.timeZone, accepting_orders: s.acceptingOrders, closed_message: s.closedMessage, extra_prep_minutes: s.extraPrepMinutes,
    enforce_opening_hours: s.enforceOpeningHours, require_contact_details: s.requireContactDetails, opening_hours: hoursDto(hours),
    open_now: status.open, closed_reason: status.reason,
  };
}

export async function updateRestaurant(patch: SettingsUpdate) {
  const fields: Partial<RestaurantSettings> & { hours?: OpeningHour[] } = {};
  if (patch.accepting_orders !== undefined) fields.acceptingOrders = patch.accepting_orders;
  if (patch.closed_message !== undefined) fields.closedMessage = patch.closed_message;
  if (patch.extra_prep_minutes !== undefined) fields.extraPrepMinutes = patch.extra_prep_minutes;
  if (patch.enforce_opening_hours !== undefined) fields.enforceOpeningHours = patch.enforce_opening_hours;
  if (patch.require_contact_details !== undefined) fields.requireContactDetails = patch.require_contact_details;
  if (patch.opening_hours) fields.hours = patch.opening_hours.map((h) => ({ weekday: h.weekday, opensAt: h.opens_at, closesAt: h.closes_at }));
  await settings.update(fields);
  return adminRestaurant();
}
