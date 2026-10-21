"use client";

import { createContext, useContext, type ReactNode } from "react";
import { can, type Access, type AnyModule, type Principal } from "./permissions";

// UI-only convenience: decides what to show. Real enforcement happens on the server (requireModule + action checks).
interface Ctx {
  principal: Principal;
  name: string;
  email: string;
}
const AccessCtx = createContext<Ctx | null>(null);

export function AccessProvider({ value, children }: { value: Ctx; children: ReactNode }) {
  return <AccessCtx.Provider value={value}>{children}</AccessCtx.Provider>;
}

export function useAccess() {
  const ctx = useContext(AccessCtx);
  if (!ctx) throw new Error("useAccess must be used inside AccessProvider");
  return {
    ...ctx,
    can: (module: AnyModule, need: Access = "view") => can(ctx.principal, module, need),
    /** True when the user may change things in this module (not just look). */
    canManage: (module: AnyModule) => can(ctx.principal, module, "manage"),
  };
}
