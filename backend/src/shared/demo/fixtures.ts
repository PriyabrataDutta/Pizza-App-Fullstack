// SEEDED DEMO DATA. Not real sales. Replaced by API-backed repositories once Phase 3 lands.
// Fixed timestamps (no Date.now) so server and client render identically.
import type { Order, OrderStatus } from "@/modules/ordering/domain";

export const DEMO_DAY = "2026-10-16";
const t = (hhmm: string) => `${DEMO_DAY}T${hhmm}:00+05:30`;

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}
export interface Variant {
  name: string;
  priceMinor: number;
}
export interface Product {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  dietary: "veg" | "non_veg";
  isSpicy: boolean;
  isBestseller: boolean;
  isActive: boolean;
  variants: Variant[];
}
export interface Customer {
  id: string;
  name: string;
  phone: string;
  orders: number;
  spentMinor: number;
  lastOrder: string;
}
export interface Coupon {
  id: string;
  code: string;
  type: "fixed" | "percentage";
  value: number; // paise for fixed, percent for percentage
  minOrderMinor: number;
  maxDiscountMinor?: number;
  usageLimit?: number;
  used: number;
  expiresAt: string;
  isActive: boolean;
}
export interface DeliveryZone {
  id: string;
  name: string;
  postalCodes: string;
  feeMinor: number;
  minOrderMinor: number;
  etaMinutes: number;
  isActive: boolean;
}

export const categories: Category[] = [
  { id: "c1", name: "Classic pizzas", sortOrder: 1, isActive: true },
  { id: "c2", name: "Signature pizzas", sortOrder: 2, isActive: true },
  { id: "c3", name: "Sides", sortOrder: 3, isActive: true },
  { id: "c4", name: "Desserts", sortOrder: 4, isActive: true },
  { id: "c5", name: "Drinks", sortOrder: 5, isActive: true },
];

const sizes = (s: number, m: number, l: number): Variant[] => [
  { name: "Small", priceMinor: s },
  { name: "Medium", priceMinor: m },
  { name: "Large", priceMinor: l },
];
const one = (p: number): Variant[] => [{ name: "Regular", priceMinor: p }];

export const products: Product[] = [
  { id: "p1", name: "Margherita", categoryId: "c1", description: "Tomato, mozzarella, basil.", dietary: "veg", isSpicy: false, isBestseller: true, isActive: true, variants: sizes(19900, 29900, 39900) },
  { id: "p2", name: "Pepperoni", categoryId: "c1", description: "Spiced pepperoni, mozzarella.", dietary: "non_veg", isSpicy: true, isBestseller: true, isActive: true, variants: sizes(24900, 34900, 44900) },
  { id: "p3", name: "Farmhouse", categoryId: "c1", description: "Capsicum, onion, mushroom, tomato.", dietary: "veg", isSpicy: false, isBestseller: false, isActive: true, variants: sizes(22900, 32900, 42900) },
  { id: "p4", name: "Paneer tikka", categoryId: "c2", description: "Tandoori paneer, onion, green chilli.", dietary: "veg", isSpicy: true, isBestseller: true, isActive: true, variants: sizes(24900, 35900, 46900) },
  { id: "p5", name: "BBQ chicken", categoryId: "c2", description: "Smoky BBQ chicken, red onion.", dietary: "non_veg", isSpicy: false, isBestseller: false, isActive: true, variants: sizes(26900, 37900, 48900) },
  { id: "p6", name: "Four cheese", categoryId: "c2", description: "Mozzarella, cheddar, parmesan, gorgonzola.", dietary: "veg", isSpicy: false, isBestseller: false, isActive: false, variants: sizes(27900, 38900, 49900) },
  { id: "p7", name: "Garlic bread", categoryId: "c3", description: "Toasted, garlic butter.", dietary: "veg", isSpicy: false, isBestseller: true, isActive: true, variants: one(11900) },
  { id: "p8", name: "Cheesy dip", categoryId: "c3", description: "Warm cheese dip.", dietary: "veg", isSpicy: false, isBestseller: false, isActive: true, variants: one(4900) },
  { id: "p9", name: "Peri-peri wings", categoryId: "c3", description: "Six wings, peri-peri glaze.", dietary: "non_veg", isSpicy: true, isBestseller: false, isActive: true, variants: one(19900) },
  { id: "p10", name: "Choco lava cake", categoryId: "c4", description: "Molten chocolate centre.", dietary: "veg", isSpicy: false, isBestseller: false, isActive: true, variants: one(8900) },
  { id: "p11", name: "Tiramisu cup", categoryId: "c4", description: "Coffee-soaked sponge, mascarpone.", dietary: "veg", isSpicy: false, isBestseller: false, isActive: true, variants: one(12900) },
  { id: "p12", name: "Cold drink", categoryId: "c5", description: "Chilled, 500 ml.", dietary: "veg", isSpicy: false, isBestseller: false, isActive: true, variants: one(5900) },
  { id: "p13", name: "Fresh lime soda", categoryId: "c5", description: "Sweet or salted.", dietary: "veg", isSpicy: false, isBestseller: false, isActive: true, variants: one(7900) },
  { id: "p14", name: "Cold coffee", categoryId: "c5", description: "Blended with ice cream.", dietary: "veg", isSpicy: false, isBestseller: false, isActive: true, variants: one(10900) },
  { id: "p15", name: "Veggie supreme", categoryId: "c2", description: "Olives, corn, jalapeño, peppers.", dietary: "veg", isSpicy: true, isBestseller: false, isActive: true, variants: sizes(23900, 33900, 43900) },
];

type Seed = {
  n: string; status: OrderStatus; name: string; phone: string; addr: string; at: string;
  lines: Order["lines"]; coupon?: string; discount?: number; note?: string; pay?: Order["paymentMethod"];
};

function build(s: Seed): Order {
  const subtotal = s.lines.reduce((a, l) => a + l.lineTotalMinor, 0);
  const discount = s.discount ?? 0;
  const tax = Math.round(((subtotal - discount) * 5) / 100);
  const fee = subtotal >= 50000 ? 0 : 3900;
  const pay = s.pay ?? "cod";
  const closedOk = s.status === "delivered";
  const hist: Order["history"] = [{ status: "placed", at: s.at, actor: "Customer" }];
  const path: OrderStatus[] = ["accepted", "preparing", "ready_for_dispatch", "out_for_delivery", "delivered"];
  if (s.status === "rejected") hist.push({ status: "rejected", at: s.at, actor: "Asha (admin)", reason: "Out of dough for large pizzas" });
  else if (s.status === "cancelled") hist.push({ status: "accepted", at: s.at, actor: "Asha (admin)" }, { status: "cancelled", at: s.at, actor: "Asha (admin)", reason: "Customer unreachable" });
  else {
    const idx = path.indexOf(s.status as OrderStatus);
    for (let i = 0; i <= idx; i++) hist.push({ status: path[i], at: s.at, actor: "Asha (admin)" });
  }
  return {
    id: `o-${s.n}`, number: `CC-${s.n}`, status: s.status,
    customerName: s.name, customerPhone: s.phone, address: s.addr, instructions: s.note,
    lines: s.lines, subtotalMinor: subtotal, discountMinor: discount, taxMinor: tax,
    deliveryFeeMinor: fee, totalMinor: subtotal - discount + tax + fee,
    couponCode: s.coupon, paymentMethod: pay,
    paymentStatus: pay === "online_demo" ? "paid" : closedOk ? "paid" : "pending",
    createdAt: s.at, history: hist,
  };
}

export const seedOrders: Order[] = [
  build({ n: "1048", status: "placed", name: "Rohan Mehta", phone: "98200 11234", addr: "Flat 402, Palm Court, Linking Road, Bandra West, 400050", at: t("19:42"), note: "Ring the bell twice", lines: [
    { name: "Pepperoni", variant: "Large", options: ["Thin crust", "Extra cheese"], quantity: 1, lineTotalMinor: 49900 },
    { name: "Garlic bread", variant: "Regular", options: [], quantity: 1, lineTotalMinor: 11900 } ] }),
  build({ n: "1047", status: "placed", name: "Priya Nair", phone: "98670 55421", addr: "12, Sea View Apts, Carter Road, Bandra West, 400050", at: t("19:39"), pay: "online_demo", coupon: "WELCOME100", discount: 10000, lines: [
    { name: "Margherita", variant: "Medium", options: ["Cheese burst"], quantity: 2, lineTotalMinor: 69800 } ] }),
  build({ n: "1046", status: "accepted", name: "Aman Kapoor", phone: "99300 87610", addr: "B-17 Shanti Nagar, Santacruz East, 400055", at: t("19:31"), lines: [
    { name: "Paneer tikka", variant: "Medium", options: ["Hand-tossed", "Jalapeño"], quantity: 1, lineTotalMinor: 38900 },
    { name: "Cold drink", variant: "Regular", options: [], quantity: 2, lineTotalMinor: 11800 } ] }),
  build({ n: "1045", status: "preparing", name: "Sneha Iyer", phone: "97690 22318", addr: "7th Floor, Orchid Tower, Juhu, 400049", at: t("19:22"), lines: [
    { name: "BBQ chicken", variant: "Large", options: ["Thin crust"], quantity: 1, lineTotalMinor: 48900 },
    { name: "Peri-peri wings", variant: "Regular", options: [], quantity: 1, lineTotalMinor: 19900 } ] }),
  build({ n: "1044", status: "preparing", name: "Karan Shah", phone: "98190 43377", addr: "Villa 3, Hill Road, Bandra West, 400050", at: t("19:15"), pay: "online_demo", lines: [
    { name: "Farmhouse", variant: "Small", options: ["Hand-tossed"], quantity: 2, lineTotalMinor: 45800 } ] }),
  build({ n: "1043", status: "ready_for_dispatch", name: "Meera Joshi", phone: "98334 70011", addr: "Door 9, Pali Naka, Bandra West, 400050", at: t("19:02"), lines: [
    { name: "Four cheese", variant: "Medium", options: ["Cheese burst"], quantity: 1, lineTotalMinor: 38900 },
    { name: "Choco lava cake", variant: "Regular", options: [], quantity: 2, lineTotalMinor: 17800 } ] }),
  build({ n: "1042", status: "out_for_delivery", name: "Vikram Rao", phone: "99876 12009", addr: "Sunrise CHS, Khar West, 400052", at: t("18:48"), coupon: "PIZZA50", discount: 5000, lines: [
    { name: "Pepperoni", variant: "Medium", options: ["Hand-tossed"], quantity: 1, lineTotalMinor: 34900 },
    { name: "Fresh lime soda", variant: "Regular", options: [], quantity: 1, lineTotalMinor: 7900 } ] }),
  build({ n: "1041", status: "delivered", name: "Divya Menon", phone: "98211 66002", addr: "A-204, Lotus Heights, Bandra East, 400051", at: t("18:20"), pay: "online_demo", lines: [
    { name: "Margherita", variant: "Large", options: [], quantity: 1, lineTotalMinor: 39900 },
    { name: "Tiramisu cup", variant: "Regular", options: [], quantity: 1, lineTotalMinor: 12900 } ] }),
  build({ n: "1040", status: "delivered", name: "Arjun Desai", phone: "97020 31188", addr: "15 Turner Road, Bandra West, 400050", at: t("17:55"), lines: [
    { name: "Veggie supreme", variant: "Medium", options: ["Thin crust"], quantity: 2, lineTotalMinor: 67800 } ] }),
  build({ n: "1039", status: "delivered", name: "Nisha Verma", phone: "98923 40450", addr: "C-8 Kalpana Society, Santacruz West, 400054", at: t("17:30"), lines: [
    { name: "Paneer tikka", variant: "Small", options: [], quantity: 1, lineTotalMinor: 24900 },
    { name: "Garlic bread", variant: "Regular", options: [], quantity: 1, lineTotalMinor: 11900 },
    { name: "Cold coffee", variant: "Regular", options: [], quantity: 1, lineTotalMinor: 10900 } ] }),
  build({ n: "1038", status: "rejected", name: "Sameer Khan", phone: "98100 99221", addr: "Plot 21, Versova, Andheri West, 400061", at: t("17:05"), lines: [
    { name: "BBQ chicken", variant: "Large", options: [], quantity: 3, lineTotalMinor: 146700 } ] }),
  build({ n: "1037", status: "cancelled", name: "Tanvi Bhatt", phone: "99203 18844", addr: "Gate 2, Mhada Colony, Andheri West, 400053", at: t("16:40"), lines: [
    { name: "Farmhouse", variant: "Medium", options: [], quantity: 1, lineTotalMinor: 32900 } ] }),
];

export const customers: Customer[] = [
  { id: "u1", name: "Rohan Mehta", phone: "98200 11234", orders: 14, spentMinor: 612000, lastOrder: t("19:42") },
  { id: "u2", name: "Priya Nair", phone: "98670 55421", orders: 9, spentMinor: 388500, lastOrder: t("19:39") },
  { id: "u3", name: "Aman Kapoor", phone: "99300 87610", orders: 3, spentMinor: 121400, lastOrder: t("19:31") },
  { id: "u4", name: "Sneha Iyer", phone: "97690 22318", orders: 21, spentMinor: 944000, lastOrder: t("19:22") },
  { id: "u5", name: "Karan Shah", phone: "98190 43377", orders: 6, spentMinor: 241300, lastOrder: t("19:15") },
  { id: "u6", name: "Divya Menon", phone: "98211 66002", orders: 2, spentMinor: 59800, lastOrder: t("18:20") },
];

export const coupons: Coupon[] = [
  { id: "k1", code: "WELCOME100", type: "fixed", value: 10000, minOrderMinor: 40000, usageLimit: 500, used: 128, expiresAt: "2026-12-31", isActive: true },
  { id: "k2", code: "PIZZA50", type: "fixed", value: 5000, minOrderMinor: 30000, used: 342, expiresAt: "2026-11-30", isActive: true },
  { id: "k3", code: "FEAST20", type: "percentage", value: 20, minOrderMinor: 80000, maxDiscountMinor: 20000, usageLimit: 200, used: 41, expiresAt: "2026-11-15", isActive: true },
  { id: "k4", code: "DIWALI25", type: "percentage", value: 25, minOrderMinor: 60000, maxDiscountMinor: 25000, usageLimit: 300, used: 300, expiresAt: "2026-10-12", isActive: false },
];

export const deliveryZones: DeliveryZone[] = [
  { id: "z1", name: "Bandra West", postalCodes: "400050", feeMinor: 2900, minOrderMinor: 19900, etaMinutes: 30, isActive: true },
  { id: "z2", name: "Khar and Santacruz", postalCodes: "400052, 400054, 400055", feeMinor: 3900, minOrderMinor: 24900, etaMinutes: 40, isActive: true },
  { id: "z3", name: "Juhu and Andheri West", postalCodes: "400049, 400053, 400058", feeMinor: 4900, minOrderMinor: 29900, etaMinutes: 50, isActive: true },
  { id: "z4", name: "Versova", postalCodes: "400061", feeMinor: 5900, minOrderMinor: 34900, etaMinutes: 60, isActive: false },
];
