// Where a picture's small copy lives. Lists and cards load the thumbnail (about 20 KB); the product screen loads the full picture.
// The rule is fixed, so nothing extra is stored: "products/abc.webp" -> "thumbs/products/abc.webp" (always WebP).

export const THUMB_WIDTH = 480;

export function thumbPath(path: string | null): string | null {
  if (!path) return null;
  return `thumbs/${path.replace(/\.[^./]+$/, "")}.webp`;
}
