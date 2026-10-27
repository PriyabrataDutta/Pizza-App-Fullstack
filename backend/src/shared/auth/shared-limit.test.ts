import { describe, expect, it, vi } from "vitest";
import { createSharedLimiter } from "./shared-limit-core";

describe("shared rate limiter", () => {
  it("asks the shared store, converting the window to seconds", async () => {
    const hit = vi.fn(async () => true);
    const allow = createSharedLimiter({ hit, fallback: () => false });
    expect(await allow("login:a", 5, 15 * 60 * 1000)).toBe(true);
    expect(hit).toHaveBeenCalledWith("login:a", 5, 900);
  });

  it("passes on the store's refusal", async () => {
    const allow = createSharedLimiter({ hit: async () => false, fallback: () => true });
    expect(await allow("k", 1, 1000)).toBe(false);
  });

  it("uses the per-instance limit when the store fails, and reports it", async () => {
    const onError = vi.fn();
    const fallback = vi.fn(() => true);
    const allow = createSharedLimiter({ hit: async () => { throw new Error("down"); }, fallback, onError });
    expect(await allow("k", 3, 60_000)).toBe(true);
    expect(fallback).toHaveBeenCalledWith("k", 3, 60_000);
    expect(onError).toHaveBeenCalledOnce();
  });

  it("uses the per-instance limit when the store is too slow", async () => {
    const fallback = vi.fn(() => false);
    const allow = createSharedLimiter({ hit: () => new Promise<boolean>(() => {}), fallback, timeoutMs: 20 });
    expect(await allow("k", 3, 60_000)).toBe(false);
    expect(fallback).toHaveBeenCalledOnce();
  });
});
