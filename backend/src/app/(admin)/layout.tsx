import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AccessProvider } from "@/modules/access/access-context";
import { getCurrentUser } from "@/modules/access/current-user";
import { OrdersProvider } from "@/modules/ordering/orders-store";

// The proxy only checks that a session cookie is valid. This loads the user from the database so a changed role,
// removed module, deactivated or deleted account applies on the very next request. Each module's layout then
// calls requireModule() for its own check.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.user.mustChangePassword) redirect("/change-password");

  return (
    <AccessProvider value={{ principal: me.principal, name: me.user.fullName, email: me.user.email }}>
      <OrdersProvider>
        <AppShell>{children}</AppShell>
      </OrdersProvider>
    </AccessProvider>
  );
}
