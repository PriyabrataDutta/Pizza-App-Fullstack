"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3, KeyRound, LayoutDashboard, LogOut, Menu as MenuIcon, Percent, Settings, ShieldCheck, ShoppingBag, Tags, Truck, UtensilsCrossed, Users, X,
} from "lucide-react";
import { useOrders } from "@/modules/ordering/orders-store";
import { useAccess } from "@/modules/access/access-context";
import { MODULE_LABEL, MODULE_PATH, ROLE_LABEL, visibleModules, type AnyModule } from "@/modules/access/permissions";
import { logout } from "@/shared/auth/actions";

const ICONS: Record<AnyModule, typeof Users> = {
  overview: LayoutDashboard, orders: ShoppingBag, menu: UtensilsCrossed, categories: Tags, customers: Users,
  offers: Percent, delivery: Truck, reports: BarChart3, settings: Settings, users: ShieldCheck,
};

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { orders } = useOrders();
  const { principal, can } = useAccess();
  const waiting = can("orders") ? orders.filter((o) => o.status === "placed").length : 0;
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {visibleModules(principal).map((m) => {
        const href = MODULE_PATH[m];
        const Icon = ICONS[m];
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={m}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors ${
              active ? "bg-brand-soft text-brand" : "text-ink hover:bg-subtle"
            }`}
          >
            <Icon className="size-[18px]" aria-hidden />
            <span className="flex-1">{MODULE_LABEL[m]}</span>
            {m === "orders" && waiting > 0 && (
              <span className="num rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${waiting} new orders`}>
                {waiting}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function SignOut() {
  const { name, email, principal } = useAccess();
  return (
    <div className="mt-auto border-t border-line pt-3">
      <div className="px-3 pb-2">
        <p className="truncate font-medium" title={name}>{name}</p>
        <p className="truncate text-xs text-ink-2" title={email}>{ROLE_LABEL[principal.role]} · {email}</p>
      </div>
      <Link href="/change-password" className="flex min-h-11 items-center gap-3 rounded-control px-3 text-sm text-ink-2 hover:bg-subtle hover:text-ink">
        <KeyRound className="size-[18px]" aria-hidden /> Change password
      </Link>
      <form action={logout}>
        <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-sm text-ink-2 hover:bg-subtle hover:text-ink">
          <LogOut className="size-[18px]" aria-hidden /> Sign out
        </button>
      </form>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-3">
      <span aria-hidden className="grid size-9 place-items-center rounded-control bg-brand text-lg font-bold text-white">C</span>
      <div className="leading-tight">
        <p className="font-semibold">Crust &amp; Co.</p>
        <p className="text-xs text-ink-2">Admin</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-surface p-3 pt-5 lg:flex">
        <Brand />
        <NavList />
        <SignOut />
      </aside>

      <div className="flex min-w-0 flex-col">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface px-4 py-2 lg:hidden">
          <Brand />
          <button onClick={() => setOpen(true)} aria-label="Open navigation" className="grid size-11 place-items-center rounded-control hover:bg-subtle">
            <MenuIcon className="size-5" aria-hidden />
          </button>
        </div>

        {open && (
          <div className="fixed inset-0 z-30 lg:hidden">
            <button aria-label="Close navigation" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 flex-col gap-6 bg-surface p-3 pt-4">
              <div className="flex items-center justify-between">
                <Brand />
                <button onClick={() => setOpen(false)} aria-label="Close navigation" className="grid size-11 place-items-center rounded-control hover:bg-subtle">
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <NavList onNavigate={() => setOpen(false)} />
              <SignOut />
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
