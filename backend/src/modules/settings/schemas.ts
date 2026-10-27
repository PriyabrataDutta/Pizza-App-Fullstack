import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 11:30.");

export const openingHourInput = z
  .object({ weekday: z.number().int().min(1).max(7), opens_at: time, closes_at: time })
  .refine((h) => h.closes_at > h.opens_at, { message: "Closing time must be after opening time. Enter a shift past midnight as two rows." });

export const settingsUpdate = z
  .object({
    accepting_orders: z.boolean(),
    closed_message: z.string().trim().max(200),
    extra_prep_minutes: z.number().int().min(0).max(180),
    enforce_opening_hours: z.boolean(),
    require_contact_details: z.boolean(),
    opening_hours: z.array(openingHourInput).max(28),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update.")
  .superRefine((v, ctx) => {
    // Two shifts on the same day must not overlap.
    const byDay = new Map<number, { o: string; c: string }[]>();
    for (const h of v.opening_hours ?? []) byDay.set(h.weekday, [...(byDay.get(h.weekday) ?? []), { o: h.opens_at, c: h.closes_at }]);
    for (const list of byDay.values()) {
      list.sort((a, b) => a.o.localeCompare(b.o));
      if (list.some((x, i) => i > 0 && x.o < list[i - 1].c)) ctx.addIssue({ code: "custom", path: ["opening_hours"], message: "Two shifts on the same day overlap." });
    }
  });

export type SettingsUpdate = z.infer<typeof settingsUpdate>;
