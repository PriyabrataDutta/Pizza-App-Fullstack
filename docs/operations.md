# Operating the restaurant system

How the restaurant is told about orders, how the site is watched, and what is still open. Written 2026-10-28.

## 1. Being told about a new order

Three layers, from the one that is always on to the one that needs setting up.

| Layer | Works when | Set up |
|---|---|---|
| **Dashboard on screen**: banner, tab title `(1) Orders`, two-note chime, repeated every 20 seconds until the order is accepted or rejected | The dashboard is open (also in a background tab: it keeps checking, browsers slow background tabs to about once a minute) | Click anywhere on the page once after opening it (browsers allow sound only after a click) |
| **Desktop notification** | The dashboard is open but hidden behind another window or tab | Click "Turn on desktop alerts" in the orders screen and allow it in the browser, once per browser |
| **Message on the phone (Telegram)** | Always, even with the dashboard closed and the PC off | Needs a free Telegram bot, see below |

### Telegram alert, step by step (about 5 minutes, free)
1. In Telegram, open a chat with **@BotFather**, send `/newbot`, give it a name and a username. It answers with a **token** (a long text like `123456:ABC...`). Treat it like a password.
2. Create a Telegram **group** for the kitchen (or use your own chat), add the new bot to it, and send any message in the group.
3. Find the group's **chat id**: open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser (with your token) and look for `"chat":{"id":-100...}`. Group ids are negative.
4. In Vercel (project `pizza-app-fullstack-backend`, **Production**), add two settings: `TELEGRAM_BOT_TOKEN` (mark it *sensitive*) and `TELEGRAM_CHAT_ID`. Redeploy.
5. Place a test order. The message arrives within seconds:
   ```
   🍕 New order CC-1061 · 17,00 €
   2× Margherita (Groß 32 cm) + Champignons
   Max Muster · 0281 123456
   Hohe Straße 12, Wesel-Mitte, 46483 Wesel
   Cash on delivery · about 35 min
   ```
Notes:
- The message is sent after the customer's order has been confirmed, so it never slows an order, and a Telegram outage never fails one. If the alert cannot be sent, the order is still in the dashboard.
- It is plain text only; nothing a customer types can become a link or formatting.
- It contains the customer's name, phone number and address. Telegram then processes that data, so mention it in the privacy policy, and use a private group with only the kitchen and drivers in it.
- Anyone in that group sees every order. Remove people who leave.

## 2. Watching that the site works

`GET https://pizza-app-fullstack-backend.vercel.app/api/health` answers `200 {"ok":true,"database":"up","ms":...}` when the server can reach its database, and `503` when it cannot or takes more than 3 seconds. It needs no login and returns no data.

Set up a free monitor (for example UptimeRobot, 5-minute checks):
1. New monitor, type HTTP(s), URL as above, alert contact your email or phone.
2. Optionally a second monitor on `.../api/restaurant` (the menu path).

What this does not cover yet: error details. For stack traces and counts of failed orders, add Sentry (create a project, then add its DSN as a Vercel setting; I can wire it in once there is a DSN).

## 3. Still open before launch (needs you)

- **Legal pages** (Impressum, Datenschutzerklärung, AGB, withdrawal information): these must carry the real business details and be checked by a lawyer. I need: legal name and form, full address, contact email and phone, VAT id (USt-IdNr.), the person responsible, the supervisory authority if any, and which tools process data (Supabase, Vercel, Telegram). I can then build the pages and link them from the app's Profile screen. I will not publish placeholder legal text.
- **Staging and backups**: the Seoul project can serve as a staging copy for a while; backups need the Supabase Pro plan.
- **Multi-factor sign-in for the dashboard** and a way to end all sessions.
