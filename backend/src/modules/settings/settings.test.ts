import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type OpeningHour, type RestaurantSettings } from "./domain";
import { settingsUpdate } from "./schemas";
import { createSettingsService, type SettingsRepository } from "./service";

function fakeRepo(initial: Partial<RestaurantSettings> = {}, hours: OpeningHour[] = []) {
  let settings = { ...DEFAULT_SETTINGS, ...initial };
  let stored = hours;
  const repo: SettingsRepository & { loads: number; fail: boolean } = {
    loads: 0, fail: false,
    async load() { repo.loads++; if (repo.fail) throw new Error("db down"); return { settings, hours: stored }; },
    async save(patch) { settings = { ...settings, ...patch }; },
    async replaceHours(h) { stored = h; },
  };
  return repo;
}

describe("settings service", () => {
  it("reads once within the cache time, and again after it", async () => {
    const repo = fakeRepo();
    let t = 0;
    const svc = createSettingsService({ repo, now: () => new Date(t), ttlMs: 10_000 });
    await svc.status(); await svc.status();
    expect(repo.loads).toBe(1);
    t = 11_000; await svc.status();
    expect(repo.loads).toBe(2);
  });

  it("an update is seen at once on this instance", async () => {
    const repo = fakeRepo();
    const svc = createSettingsService({ repo });
    expect((await svc.status()).open).toBe(true);
    await svc.update({ acceptingOrders: false, closedMessage: "Back at 18:00" });
    expect(await svc.status()).toMatchObject({ open: false, message: "Back at 18:00" });
  });

  it("reports prep time and the contact rule for checkout", async () => {
    const svc = createSettingsService({ repo: fakeRepo({ extraPrepMinutes: 15, requireContactDetails: true }) });
    expect(await svc.status()).toMatchObject({ extraPrepMinutes: 15, requireContactDetails: true });
  });

  it("counts as open when the settings cannot be read, so a glitch does not turn customers away", async () => {
    const repo = fakeRepo(); repo.fail = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await createSettingsService({ repo }).status()).open).toBe(true);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("does not ask a broken settings store again on every order", async () => {
    const repo = fakeRepo(); repo.fail = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const svc = createSettingsService({ repo, ttlMs: 10_000 });
    await svc.status(); await svc.status(); await svc.status();
    expect(repo.loads).toBe(1);
    log.mockRestore();
  });

  it("keeps using the last good settings when a later read fails", async () => {
    const repo = fakeRepo({ acceptingOrders: false });
    let t = 0;
    const svc = createSettingsService({ repo, now: () => new Date(t), ttlMs: 1000 });
    expect((await svc.status()).open).toBe(false);
    repo.fail = true; t = 5000;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await svc.status()).open).toBe(false);
    log.mockRestore();
  });
});

describe("settings update schema", () => {
  const ok = (v: unknown) => settingsUpdate.safeParse(v).success;
  it("accepts partial changes and rejects empty ones", () => {
    expect(ok({ accepting_orders: false })).toBe(true);
    expect(ok({})).toBe(false);
  });
  it("limits prep time and message length", () => {
    expect(ok({ extra_prep_minutes: 181 })).toBe(false);
    expect(ok({ extra_prep_minutes: -1 })).toBe(false);
    expect(ok({ closed_message: "x".repeat(201) })).toBe(false);
  });
  it("checks opening hours: valid times, closing after opening, no overlap", () => {
    expect(ok({ opening_hours: [{ weekday: 1, opens_at: "11:00", closes_at: "14:00" }, { weekday: 1, opens_at: "17:00", closes_at: "22:00" }] })).toBe(true);
    expect(ok({ opening_hours: [{ weekday: 1, opens_at: "11:00", closes_at: "25:00" }] })).toBe(false);
    expect(ok({ opening_hours: [{ weekday: 1, opens_at: "20:00", closes_at: "02:00" }] })).toBe(false);
    expect(ok({ opening_hours: [{ weekday: 8, opens_at: "11:00", closes_at: "12:00" }] })).toBe(false);
    expect(ok({ opening_hours: [{ weekday: 1, opens_at: "11:00", closes_at: "15:00" }, { weekday: 1, opens_at: "14:00", closes_at: "20:00" }] })).toBe(false);
  });
});
