import { DEFAULT_SETTINGS, normaliseHours, openStatus, type OpenStatus, type OpeningHour, type RestaurantSettings } from "./domain";

/** Storage for the settings. A fake in tests, Supabase in production (./repository). */
export interface SettingsRepository {
  load(): Promise<{ settings: RestaurantSettings; hours: OpeningHour[] }>;
  save(patch: Partial<RestaurantSettings>): Promise<void>;
  replaceHours(hours: OpeningHour[]): Promise<void>;
}

export interface RestaurantStatus extends OpenStatus {
  extraPrepMinutes: number;
  requireContactDetails: boolean;
}

export interface SettingsDeps {
  repo: SettingsRepository;
  now?: () => Date;
  /** How long a read is reused. A change in the dashboard reaches checkout within this time on every instance. */
  ttlMs?: number;
}

/**
 * Reads the settings with a short cache (checkout asks on every order). If they cannot be read, the restaurant counts as open with the
 * defaults and the failure is logged: when the database is down nothing else works either, and a settings glitch alone must not
 * turn customers away.
 */
export function createSettingsService({ repo, now = () => new Date(), ttlMs = 10_000 }: SettingsDeps) {
  let cached: { at: number; value: { settings: RestaurantSettings; hours: OpeningHour[] } } | null = null;

  async function read() {
    if (cached && now().getTime() - cached.at < ttlMs) return cached.value;
    try {
      const value = await repo.load();
      cached = { at: now().getTime(), value: { settings: value.settings, hours: normaliseHours(value.hours) } };
      return cached.value;
    } catch (error) {
      console.error("restaurant settings unavailable", error instanceof Error ? error.message : error);
      // Remember the fallback for one cache period too, so a broken or missing settings table is not asked again on every order.
      const fallback = cached?.value ?? { settings: DEFAULT_SETTINGS, hours: [] };
      cached = { at: now().getTime(), value: fallback };
      return fallback;
    }
  }

  const service = {
    async get() {
      const { settings, hours } = await read();
      return { settings, hours, status: openStatus(settings, hours, now()) };
    },

    async status(): Promise<RestaurantStatus> {
      const { settings, hours } = await read();
      return { ...openStatus(settings, hours, now()), extraPrepMinutes: settings.extraPrepMinutes, requireContactDetails: settings.requireContactDetails };
    },

    async update(patch: Partial<RestaurantSettings> & { hours?: OpeningHour[] }) {
      const { hours, ...fields } = patch;
      if (Object.keys(fields).length > 0) await repo.save(fields);
      if (hours) await repo.replaceHours(hours);
      cached = null; // the next read on this instance sees the change at once
      return service.get();
    },
  };
  return service;
}

export type SettingsService = ReturnType<typeof createSettingsService>;
