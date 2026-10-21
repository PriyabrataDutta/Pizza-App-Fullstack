"use client";

import { useSyncExternalStore } from "react";
import { BellRing, CircleAlert, RefreshCw, Volume2, VolumeX, WifiOff, X } from "lucide-react";
import { formatTime } from "@/shared/format";
import { formatEuro } from "@/modules/catalog/money";
import { prepareChime, setSoundOn, soundOn, subscribeSound } from "./chime";
import { useOrders } from "./orders-store";

/**
 * What the person at the counter needs to know about the connection and about changes: new orders that just arrived, a status
 * change the server refused, and whether the screen is up to date. Shared by the Orders board and the Overview.
 */
export function OrdersStatus() {
  const { error, clearError, offline, updatedAt, arrivals, dismissArrivals, refresh } = useOrders();
  const sound = useSyncExternalStore(subscribeSound, soundOn, () => true);
  return (
    <div className="mb-4 space-y-2">
      {arrivals.length > 0 && (
        <div role="status" className="flex items-start gap-3 rounded-control border border-success/30 bg-success-soft px-3 py-2 text-[13px] text-success">
          <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="flex-1">
            <span className="font-semibold">{arrivals.length === 1 ? "New order" : `${arrivals.length} new orders`}:</span>{" "}
            {arrivals.map((o) => `${o.number} (${formatEuro(o.totalMinor)})`).join(", ")}
          </p>
          <button onClick={dismissArrivals} className="-m-1 rounded p-1 hover:bg-white/50" aria-label="Dismiss new order alert">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-control border border-error/30 bg-error-soft px-3 py-2 text-[13px] text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="flex-1">{error}</p>
          <button onClick={clearError} className="-m-1 rounded p-1 hover:bg-white/50" aria-label="Dismiss message">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
        {offline ? (
          <span role="status" className="inline-flex items-center gap-1.5 font-medium text-warning">
            <WifiOff className="size-3.5" aria-hidden /> Can’t reach the server. Showing the last orders received{updatedAt ? ` at ${formatTime(updatedAt.toISOString())}` : ""}.
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-success" aria-hidden /> Live{updatedAt ? ` · updated ${formatTime(updatedAt.toISOString())}` : ""}
          </span>
        )}
        <button onClick={() => void refresh()} className="inline-flex min-h-8 items-center gap-1 font-medium text-brand hover:underline">
          <RefreshCw className="size-3.5" aria-hidden /> Refresh
        </button>
        <button
          onClick={() => { prepareChime(); setSoundOn(!sound); }}
          aria-pressed={sound}
          className="inline-flex min-h-8 items-center gap-1 font-medium text-ink-2 hover:text-ink"
        >
          {sound ? <Volume2 className="size-3.5" aria-hidden /> : <VolumeX className="size-3.5" aria-hidden />}
          New order sound: {sound ? "on" : "off"}
        </button>
      </div>
    </div>
  );
}
