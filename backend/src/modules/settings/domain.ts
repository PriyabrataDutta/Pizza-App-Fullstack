// Is the restaurant taking orders right now? Pure rules, no storage. Times are in the restaurant's own time zone, never the server's.

export interface RestaurantSettings {
  name: string;
  timeZone: string;
  acceptingOrders: boolean;
  closedMessage: string;
  extraPrepMinutes: number;
  enforceOpeningHours: boolean;
  requireContactDetails: boolean;
}

/** weekday: 1 = Monday ... 7 = Sunday. Times are "HH:MM" in the restaurant's time zone. A shift past midnight is two rows. */
export interface OpeningHour {
  weekday: number;
  opensAt: string;
  closesAt: string;
}

export type ClosedReason = "switched_off" | "outside_hours";

export interface OpenStatus {
  open: boolean;
  reason: ClosedReason | null;
  /** Text for the customer when closed. */
  message: string;
}

export const DEFAULT_SETTINGS: RestaurantSettings = {
  name: "Crust & Co. Pizza House",
  timeZone: "Europe/Berlin",
  acceptingOrders: true,
  closedMessage: "",
  extraPrepMinutes: 0,
  enforceOpeningHours: false,
  requireContactDetails: false,
};

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** The weekday and the "HH:MM" on the wall clock of the restaurant at this moment. */
export function localClock(now: Date, timeZone: string): { weekday: number; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { weekday: WEEKDAYS[get("weekday")] ?? 1, time: `${get("hour")}:${get("minute")}` };
}

const hhmm = (t: string) => t.slice(0, 5); // the database returns "11:00:00"

export function openStatus(settings: RestaurantSettings, hours: OpeningHour[], now: Date): OpenStatus {
  if (!settings.acceptingOrders) {
    return { open: false, reason: "switched_off", message: settings.closedMessage.trim() || "We are not taking orders right now. Please try again later." };
  }
  if (settings.enforceOpeningHours) {
    const { weekday, time } = localClock(now, settings.timeZone);
    const inside = hours.some((h) => h.weekday === weekday && hhmm(h.opensAt) <= time && time < hhmm(h.closesAt));
    if (!inside) {
      return { open: false, reason: "outside_hours", message: settings.closedMessage.trim() || "We are closed at the moment. See our opening hours and order again then." };
    }
  }
  return { open: true, reason: null, message: "" };
}

/** Hours sorted by day and time, with the database's seconds dropped. */
export function normaliseHours(hours: OpeningHour[]): OpeningHour[] {
  return hours
    .map((h) => ({ weekday: h.weekday, opensAt: hhmm(h.opensAt), closesAt: hhmm(h.closesAt) }))
    .sort((a, b) => a.weekday - b.weekday || a.opensAt.localeCompare(b.opensAt));
}
