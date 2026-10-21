"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { nextTransitions, type Order, type OrderStatus } from "./domain";
import { seedOrders } from "@/shared/demo/fixtures";

interface OrdersApi {
  orders: Order[];
  /** Applies a transition only if the lifecycle allows it; otherwise a no-op. */
  transition: (id: string, to: OrderStatus, reason?: string) => void;
}

const Ctx = createContext<OrdersApi | null>(null);

// Demo state holder. Swap for API-backed data (PATCH /api/admin/orders/{id}/status) in Phase 3 integration.
export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(seedOrders);

  const transition = useCallback((id: string, to: OrderStatus, reason?: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id || !nextTransitions(o.status).some((t) => t.to === to)) return o;
        const at = new Date().toISOString();
        return { ...o, status: to, history: [...o.history, { status: to, at, actor: "You (demo)", reason }] };
      }),
    );
  }, []);

  const value = useMemo(() => ({ orders, transition }), [orders, transition]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrders(): OrdersApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOrders must be used inside OrdersProvider");
  return v;
}
