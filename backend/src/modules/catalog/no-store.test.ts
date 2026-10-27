import { describe, expect, it } from "vitest";
import { noStore } from "./no-store";

describe("private responses are never cached", () => {
  it("adds no-store to a response that says nothing (an error, for example)", () => {
    expect(noStore(new Response(null, { status: 401 })).headers.get("Cache-Control")).toBe("no-store");
  });

  it("leaves an explicit choice alone", () => {
    expect(noStore(new Response(null, { headers: { "Cache-Control": "private, max-age=5" } })).headers.get("Cache-Control")).toBe("private, max-age=5");
  });
});
