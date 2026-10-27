import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, localClock, normaliseHours, openStatus, type OpeningHour } from "./domain";

const hours: OpeningHour[] = [
  { weekday: 1, opensAt: "11:00", closesAt: "14:00" },
  { weekday: 1, opensAt: "17:00", closesAt: "22:00" },
  { weekday: 6, opensAt: "11:00:00", closesAt: "23:00:00" },
];
const enforced = { ...DEFAULT_SETTINGS, enforceOpeningHours: true };
// Monday 2026-10-26: Berlin is on summer time until 25 Oct 03:00, so on the 26th it is UTC+1.
const mondayAt = (hhmmUtc: string) => new Date(`2026-10-26T${hhmmUtc}:00Z`);

describe("local clock", () => {
  it("reads the wall clock of the restaurant, not of the server", () => {
    expect(localClock(mondayAt("10:30"), "Europe/Berlin")).toEqual({ weekday: 1, time: "11:30" });
    expect(localClock(mondayAt("23:30"), "Europe/Berlin")).toEqual({ weekday: 2, time: "00:30" }); // already Tuesday in Berlin
  });
  it("follows the change between summer and winter time", () => {
    expect(localClock(new Date("2026-07-06T09:00:00Z"), "Europe/Berlin").time).toBe("11:00"); // UTC+2
    expect(localClock(new Date("2026-12-07T09:00:00Z"), "Europe/Berlin").time).toBe("10:00"); // UTC+1
  });
});

describe("open status", () => {
  it("is open by default", () => {
    expect(openStatus(DEFAULT_SETTINGS, [], new Date()).open).toBe(true);
  });

  it("is closed when the switch is off, whatever the hours say, with the restaurant's own message", () => {
    const s = openStatus({ ...enforced, acceptingOrders: false, closedMessage: "Kitchen is full, back at 19:00" }, hours, mondayAt("10:30"));
    expect(s).toEqual({ open: false, reason: "switched_off", message: "Kitchen is full, back at 19:00" });
  });

  it("ignores the hours until they are enforced", () => {
    expect(openStatus(DEFAULT_SETTINGS, hours, mondayAt("03:00")).open).toBe(true);
  });

  it("follows the opening hours once enforced: inside a shift, in the break, and after closing", () => {
    expect(openStatus(enforced, hours, mondayAt("10:30")).open).toBe(true);  // 11:30 Berlin
    expect(openStatus(enforced, hours, mondayAt("14:00")).open).toBe(false); // 15:00 Berlin, the afternoon break
    expect(openStatus(enforced, hours, mondayAt("21:30")).reason).toBe("outside_hours"); // 22:30 Berlin
  });

  it("opens on the minute and closes on the minute", () => {
    expect(openStatus(enforced, hours, mondayAt("09:59")).open).toBe(false); // 10:59 Berlin, a minute before opening
    expect(openStatus(enforced, hours, mondayAt("10:00")).open).toBe(true);  // 11:00 sharp
    expect(openStatus(enforced, hours, mondayAt("12:59")).open).toBe(true);  // 13:59, the last minute
    expect(openStatus(enforced, hours, mondayAt("13:00")).open).toBe(false); // 14:00 sharp: closed
  });

  it("is closed on a day with no hours", () => {
    expect(openStatus(enforced, hours, new Date("2026-10-27T12:00:00Z")).open).toBe(false); // Tuesday
  });

  it("accepts times with seconds, as the database returns them", () => {
    expect(openStatus(enforced, hours, new Date("2026-10-24T12:00:00Z")).open).toBe(true); // Saturday 14:00 Berlin (summer time)
  });
});

describe("normalise hours", () => {
  it("sorts and drops seconds", () => {
    expect(normaliseHours([hours[2], hours[1], hours[0]])).toEqual([
      { weekday: 1, opensAt: "11:00", closesAt: "14:00" }, { weekday: 1, opensAt: "17:00", closesAt: "22:00" }, { weekday: 6, opensAt: "11:00", closesAt: "23:00" },
    ]);
  });
});
