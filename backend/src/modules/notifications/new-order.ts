// The message the restaurant gets on their phone when an order is placed. Plain text on purpose: nothing a customer typed is ever
// interpreted as formatting or a link. Pure, so it can be tested without a network.
import { formatEuro } from "../catalog/money";
import type { OrderDto } from "../checkout/order-dto";

export function formatNewOrderMessage(order: OrderDto): string {
  const lines = order.lines.map((l) => {
    const extras = l.options.length > 0 ? ` + ${l.options.join(", ")}` : "";
    return `${l.quantity}× ${l.name} (${l.portion})${extras}`;
  });
  const who = [order.contact.name, order.contact.phone].filter(Boolean).join(" · ");
  const parts = [
    `🍕 New order ${order.number} · ${formatEuro(order.total_minor)}`,
    ...lines,
    who || "No contact details given",
    order.delivery_address,
    order.delivery.instructions ? `Note: ${order.delivery.instructions}` : "",
    `${order.payment_method === "cod" ? "Cash on delivery" : order.payment_method}${order.estimated_minutes ? ` · about ${order.estimated_minutes} min` : ""}`,
  ];
  // Telegram refuses messages over 4096 characters; a real order is a few hundred.
  return parts.filter(Boolean).join("\n").slice(0, 3500);
}

export interface TelegramConfig {
  token: string;
  chatId: string;
}

/** Both settings must be present. Anything less means alerts by phone are simply not set up. */
export function telegramConfig(env: Record<string, string | undefined>): TelegramConfig | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();
  return token && chatId ? { token, chatId } : null;
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number }>;

/** Sends the alert. Never throws: a missed alert must not fail or delay an order. The token is never logged. */
export async function sendTelegram(config: TelegramConfig, text: string, fetchImpl: Fetch = fetch as unknown as Fetch, timeoutMs = 4000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: config.chatId, text, disable_web_page_preview: true }),
      signal: controller.signal,
    });
    if (!res.ok) console.error(`new-order alert: Telegram answered ${res.status}`);
    return res.ok;
  } catch {
    console.error("new-order alert: Telegram could not be reached");
    return false;
  } finally {
    clearTimeout(timer);
  }
}
