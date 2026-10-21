import { describe, expect, it } from "vitest";
import { clearFailures, isIpLocked, isLocked, recordFailure, recordIpFailure } from "./rate-limit";

describe("login throttling", () => {
  it("locks an email after 5 failures and clears on success", () => {
    const email = "Throttle.One@Example.test";
    for (let i = 0; i < 4; i++) recordFailure(email);
    expect(isLocked(email)).toBe(false);
    recordFailure(email);
    expect(isLocked("throttle.one@example.test")).toBe(true); // case-insensitive
    clearFailures(email);
    expect(isLocked(email)).toBe(false);
  });

  it("locks an address after 30 failures across different emails", () => {
    const ip = "203.0.113.7";
    for (let i = 0; i < 29; i++) recordIpFailure(ip);
    expect(isIpLocked(ip)).toBe(false);
    recordIpFailure(ip);
    expect(isIpLocked(ip)).toBe(true);
    expect(isIpLocked("203.0.113.8")).toBe(false); // another address is unaffected
  });
});
