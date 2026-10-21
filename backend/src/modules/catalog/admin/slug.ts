/** "Pizzabrötchen" becomes "pizzabroetchen". German letters are spelled out; anything else non-alphanumeric becomes a hyphen. */
export function slugify(text: string): string {
  const spelled: Record<string, string> = { "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss", "Ä": "ae", "Ö": "oe", "Ü": "ue" };
  return text
    .replace(/[äöüßÄÖÜ]/g, (c) => spelled[c])
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The first of slug, slug-2, slug-3 ... that is not in `taken`. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  const root = base || "item";
  if (!taken.has(root)) return root;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${root}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${root}-${Date.now()}`;
}
