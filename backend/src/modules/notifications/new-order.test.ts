import { describe, expect, it, vi } from "vitest";
import type { OrderDto } from "../checkout/order-dto";
import { formatNewOrderMessage, sendTelegram, telegramConfig } from "./new-order";

const order = (over: Partial<OrderDto> = {}): OrderDto => ({
  id: "o1", number: "CC-1061", status: "placed", total_minor: 1700, currency: "EUR", created_at: "2026-10-28T12:00:00Z",
  subtotal_minor: 1700, discount_minor: 0, tax_minor: 0, delivery_fee_minor: 0, coupon_code: null, payment_method: "cod", payment_status: "pending",
  estimated_minutes: 35, delivery_address: "Hohe Straße 12, Wesel-Mitte, 46483 Wesel",
  delivery: { label: "Home", line1: "Hohe Straße 12", locality: "Wesel-Mitte", city: "Wesel", postal_code: "46483", instructions: null },
  contact: { name: "Max Muster", phone: "0281 123456" },
  lines: [{ name: "Margherita", portion: "Groß 32 cm", options: ["Champignons"], quantity: 2, unit_price_minor: 850, line_total_minor: 1700 }],
  history: [], ...over,
});

describe("the alert text", () => {
  it("has what the kitchen and the driver need, at a glance", () => {
    const text = formatNewOrderMessage(order());
    expect(text).toContain("New order CC-1061");
    expect(text).toContain("17,00");
    expect(text).toContain("2× Margherita (Groß 32 cm) + Champignons");
    expect(text).toContain("Max Muster · 0281 123456");
    expect(text).toContain("Hohe Straße 12, Wesel-Mitte, 46483 Wesel");
    expect(text).toContain("Cash on delivery · about 35 min");
  });

  it("says so when there are no contact details, and shows the customer's note", () => {
    const text = formatNewOrderMessage(order({ contact: { name: null, phone: null }, delivery: { label: "Home", line1: "x", locality: "y", city: "Wesel", postal_code: "46483", instructions: "Ring twice" } }));
    expect(text).toContain("No contact details given");
    expect(text).toContain("Note: Ring twice");
  });

  it("stays well under the message limit even for a huge order", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ name: `Pizza ${i}`.padEnd(60, "x"), portion: "Groß", options: ["a".repeat(80)], quantity: 1, unit_price_minor: 1, line_total_minor: 1 }));
    expect(formatNewOrderMessage(order({ lines: many })).length).toBeLessThanOrEqual(3500);
  });
});

describe("is the phone alert set up", () => {
  it("needs both the token and the chat", () => {
    expect(telegramConfig({})).toBeNull();
    expect(telegramConfig({ TELEGRAM_BOT_TOKEN: "t" })).toBeNull();
    expect(telegramConfig({ TELEGRAM_CHAT_ID: "1" })).toBeNull();
    expect(telegramConfig({ TELEGRAM_BOT_TOKEN: " t ", TELEGRAM_CHAT_ID: " 1 " })).toEqual({ token: "t", chatId: "1" });
  });
});

describe("sending the alert", () => {
  const cfg = { token: "SECRET-TOKEN", chatId: "42" };

  it("posts the text to the chat, as plain text", async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200 }));
    expect(await sendTelegram(cfg, "hello", f)).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe("https://api.telegram.org/botSECRET-TOKEN/sendMessage");
    expect(JSON.parse(init.body)).toEqual({ chat_id: "42", text: "hello", disable_web_page_preview: true });
    expect(init.body).not.toContain("parse_mode");
  });

  it("never throws and never logs the token when Telegram refuses or cannot be reached", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendTelegram(cfg, "x", async () => ({ ok: false, status: 401 }))).toBe(false);
    expect(await sendTelegram(cfg, "x", async () => { throw new Error(`fetch failed for https://api.telegram.org/botSECRET-TOKEN/sendMessage`); })).toBe(false);
    expect(log.mock.calls.flat().join(" ")).not.toContain("SECRET-TOKEN");
    log.mockRestore();
  });

  it("gives up after the timeout instead of holding the request", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const slow = (_u: string, init: { signal: AbortSignal }) => new Promise<{ ok: boolean; status: number }>((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
    expect(await sendTelegram(cfg, "x", slow as never, 20)).toBe(false);
    log.mockRestore();
  });
});
