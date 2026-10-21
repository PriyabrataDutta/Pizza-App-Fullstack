import { describe, expect, it } from "vitest";
import { thumbPath } from "./image-paths";

describe("thumbPath", () => {
  it("puts the small copy under thumbs/ and always as webp", () => {
    expect(thumbPath("products/abc.webp")).toBe("thumbs/products/abc.webp");
    expect(thumbPath("categories/pizza.webp")).toBe("thumbs/categories/pizza.webp");
    expect(thumbPath("products/photo.JPG")).toBe("thumbs/products/photo.webp");
    expect(thumbPath("a/b.c/d.png")).toBe("thumbs/a/b.c/d.webp");
  });
  it("has no thumbnail when there is no picture", () => {
    expect(thumbPath(null)).toBeNull();
    expect(thumbPath("")).toBeNull();
  });
});
