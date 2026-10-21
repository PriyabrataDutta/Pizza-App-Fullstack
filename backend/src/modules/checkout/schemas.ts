import { z } from "zod";

// Request bodies for the customer API. Snake_case, like the rest. Money never appears here: the app sends ids and quantities only.

const uuid = z.string().uuid();
const portionKey = z.string().min(1).max(30).regex(/^[a-z0-9_]+$/, "Invalid size.");
const couponCode = z.string().trim().min(1).max(30).transform((s) => s.toUpperCase());

export const cartItem = z.object({
  product_id: uuid,
  portion_key: portionKey,
  option_ids: z.array(uuid).max(50).default([]),
  quantity: z.number().int().min(1).max(99),
});

const items = z.array(cartItem).min(1, "Your cart is empty.").max(50, "That is too many different items for one order.");

export const quoteRequest = z.object({
  items,
  coupon_code: couponCode.optional(),
  address_id: uuid.optional(),
});

export const checkoutRequest = z.object({
  idempotency_key: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/, "The idempotency key must be 8 to 100 letters, digits, - or _."),
  address_id: uuid,
  payment_method: z.enum(["cod", "online_demo"]),
  coupon_code: couponCode.optional(),
  instructions: z.string().trim().max(300).optional(),
  items,
});

const addressFields = {
  label: z.string().trim().min(1, "Give the address a name, like Home.").max(40),
  line1: z.string().trim().min(1, "Enter the street and number.").max(120),
  locality: z.string().trim().min(1, "Enter the district.").max(80),
  city: z.string().trim().min(1, "Enter the city.").max(80),
  postal_code: z.string().regex(/^[0-9]{5}$/, "Enter a 5-digit postcode."),
  instructions: z.string().trim().max(300).nullable(),
  is_default: z.boolean(),
};

export const addressCreate = z.object({
  label: addressFields.label,
  line1: addressFields.line1,
  locality: addressFields.locality,
  city: addressFields.city,
  postal_code: addressFields.postal_code,
  instructions: addressFields.instructions.optional(),
  is_default: addressFields.is_default.optional(),
});

// No defaults here: an update must change only what it was given.
export const addressUpdate = z.object(addressFields).partial().refine((v) => Object.keys(v).length > 0, "Nothing to update.");

export type CartItemInput = z.infer<typeof cartItem>;
export type QuoteRequest = z.infer<typeof quoteRequest>;
export type CheckoutRequest = z.infer<typeof checkoutRequest>;
export type AddressCreate = z.infer<typeof addressCreate>;
export type AddressUpdate = z.infer<typeof addressUpdate>;
