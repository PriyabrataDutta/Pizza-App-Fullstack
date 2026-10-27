import { z } from "zod";
import { imagePath } from "../catalog/admin/schemas";

// Request bodies for the offer-banner admin API.

const when = z.iso.datetime({ offset: true });
const code = z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, "Use 3 to 30 letters or numbers, no spaces.");

const fields = {
  title: z.string().trim().min(1, "Enter a headline.").max(80, "Keep the headline under 80 characters."),
  detail: z.string().trim().max(200, "Keep the detail under 200 characters."),
  coupon_code: code.nullable(),
  image_path: imagePath.nullable(),
  is_active: z.boolean(),
  starts_at: when.nullable(),
  ends_at: when.nullable(),
};

const window = (v: { starts_at?: string | null; ends_at?: string | null }) =>
  !v.starts_at || !v.ends_at || new Date(v.ends_at).getTime() > new Date(v.starts_at).getTime();
const WINDOW_MESSAGE = { message: "The end must be after the start.", path: ["ends_at"] };

export const promotionCreate = z
  .object({
    title: fields.title,
    detail: fields.detail.default(""),
    coupon_code: fields.coupon_code.default(null),
    image_path: fields.image_path.default(null),
    is_active: fields.is_active.default(true),
    starts_at: fields.starts_at.default(null),
    ends_at: fields.ends_at.default(null),
  })
  .refine(window, WINDOW_MESSAGE);

// No defaults: an update changes only what it was given.
export const promotionUpdate = z
  .object(fields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update.")
  .refine(window, WINDOW_MESSAGE);

export type PromotionCreate = z.infer<typeof promotionCreate>;
export type PromotionUpdate = z.infer<typeof promotionUpdate>;
