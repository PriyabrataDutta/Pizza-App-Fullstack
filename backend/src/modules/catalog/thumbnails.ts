import "server-only";
import sharp from "sharp";
import { adminClient } from "@/shared/supabase/server";
import { THUMB_WIDTH, thumbPath } from "./image-paths";

const BUCKET = "product-images";

/**
 * Makes the small copy of a picture that was just saved on a product or category. Best effort: if it fails the full picture
 * still works (the app falls back to it), and the picture can be saved again to retry.
 */
export async function ensureThumbnail(path: string | null | undefined): Promise<void> {
  const target = thumbPath(path ?? null);
  if (!path || !target) return;
  try {
    const storage = adminClient().storage.from(BUCKET);
    const { data, error } = await storage.download(path);
    if (error || !data) throw new Error(error?.message ?? "no data");
    const small = await sharp(Buffer.from(await data.arrayBuffer()))
      .rotate()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
    const up = await storage.upload(target, small, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
    if (up.error) throw new Error(up.error.message);
  } catch (e) {
    console.error(`thumbnail for ${path} failed:`, e instanceof Error ? e.message : e);
  }
}
