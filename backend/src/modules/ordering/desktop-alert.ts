// A desktop notification for a new order, so it is noticed when the dashboard is in another tab or behind another window. The browser asks
// the person once; until they allow it, nothing is shown and the sound, the banner and the tab title still work.

export type AlertPermission = "granted" | "denied" | "default" | "unsupported";

export function desktopAlertState(): AlertPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** Must be called from a click: browsers refuse to ask otherwise. */
export async function enableDesktopAlerts(): Promise<AlertPermission> {
  if (desktopAlertState() === "unsupported") return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return desktopAlertState();
  }
}

/** Shown only while the page is hidden: when it is in front, the banner and the sound already say it. */
export function showDesktopAlert(title: string, body: string) {
  if (desktopAlertState() !== "granted" || document.visibilityState === "visible") return;
  try {
    // One notification at a time (tag), and it stays until someone reacts to it, because an unnoticed order is the thing to avoid.
    new Notification(title, { body, tag: "cc-new-order", requireInteraction: true });
  } catch {
    // some browsers only allow notifications from a service worker: the sound and the title still work
  }
}
