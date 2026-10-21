"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAccess } from "@/modules/access/access-context";
import { adminApi, ApiError } from "@/modules/catalog/admin-client";
import { nextTransitions, type Order, type OrderStatus } from "./domain";
import { fromAdminOrder } from "./from-api";

interface OrdersApi {
  orders: Order[];
  /** True until the first load has finished. */
  loading: boolean;
  /** The last status change that was refused or failed, in words the person can act on. Null when there is none. */
  error: string | null;
  clearError: () => void;
  /** True while the latest refresh could not reach the server. The orders on screen are then the last ones received. */
  offline: boolean;
  /** When the orders on screen were last confirmed by the server. */
  updatedAt: Date | null;
  /** Orders that arrived since the screen was opened and have not been dismissed. Newest first. */
  arrivals: Order[];
  dismissArrivals: () => void;
  /** Ids with a status change in flight, so their buttons can be disabled. */
  busy: ReadonlySet<string>;
  /** Moves an order along the lifecycle. The server decides; the screen shows what it answers. */
  transition: (id: string, to: OrderStatus, reason?: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<OrdersApi | null>(null);

const POLL_MS = 8000;

/**
 * Orders from the database. Loaded when the dashboard opens, refreshed every few seconds while the tab is visible (and the moment
 * it becomes visible again), so a new order appears without anyone reloading the page.
 */
export function OrdersProvider({ children }: { children: ReactNode }) {
  const allowed = useAccess().can("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(allowed);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [arrivals, setArrivals] = useState<Order[]>([]);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  const known = useRef<Set<string> | null>(null); // ids seen so far; null until the first load
  const inFlight = useRef<Set<string>>(new Set());
  const mounted = useRef(true);
  const current = useRef<Order[]>([]);

  const load = useCallback(async () => {
    try {
      const { items } = await adminApi.orders.list();
      if (!mounted.current) return;
      const fresh = items.map(fromAdminOrder);
      // A change this person just made is answered by its own request; keep it rather than flicker back to the older list.
      const merged = fresh.map((o) => (inFlight.current.has(o.id) ? current.current.find((c) => c.id === o.id) ?? o : o));
      if (known.current) {
        const added = merged.filter((o) => !known.current!.has(o.id) && o.status === "placed");
        if (added.length > 0) setArrivals((prev) => [...added, ...prev].slice(0, 5));
      }
      known.current = new Set(merged.map((o) => o.id));
      current.current = merged;
      setOrders(merged);
      setOffline(false);
      setUpdatedAt(new Date());
    } catch (e) {
      if (!mounted.current) return;
      // Not allowed to see orders is not an outage: show nothing and stop trying.
      if (e instanceof ApiError && (e.status === 403 || e.status === 401)) setOrders([]);
      else setOffline(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!allowed) return () => { mounted.current = false; };
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [allowed, load]);

  const transition = useCallback(async (id: string, to: OrderStatus, reason?: string) => {
    const order = current.current.find((o) => o.id === id);
    if (!order || inFlight.current.has(id) || !nextTransitions(order.status).some((t) => t.to === to)) return;
    inFlight.current.add(id);
    setBusy(new Set(inFlight.current));
    setError(null);
    try {
      const updated = fromAdminOrder(await adminApi.orders.setStatus(id, to, reason));
      current.current = current.current.map((o) => (o.id === id ? updated : o));
      if (mounted.current) {
        setOrders(current.current);
        setUpdatedAt(new Date());
      }
    } catch (e) {
      if (!mounted.current) return;
      setError(
        e instanceof ApiError && e.code === "INVALID_TRANSITION"
          ? `Order ${order.number} was already moved on, maybe from another screen. The board now shows where it is.`
          : e instanceof ApiError ? e.message : "Could not update the order. Try again.",
      );
      // The order may have been changed elsewhere (another tablet): show what the server has now.
      if (e instanceof ApiError && e.status === 409) await load();
    } finally {
      inFlight.current.delete(id);
      if (mounted.current) setBusy(new Set(inFlight.current));
    }
  }, [load]);

  const value = useMemo<OrdersApi>(
    () => ({
      orders, loading, error, offline, updatedAt, arrivals, busy, transition,
      clearError: () => setError(null),
      dismissArrivals: () => setArrivals([]),
      refresh: load,
    }),
    [orders, loading, error, offline, updatedAt, arrivals, busy, transition, load],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrders(): OrdersApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOrders must be used inside OrdersProvider");
  return v;
}
