const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

/** Money is stored as integer minor units (paise). Never do float math on it. */
export function formatMoney(minor: number): string {
  return inr.format(minor / 100);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

export function minutesAgo(iso: string, now = Date.now()): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
}

export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
