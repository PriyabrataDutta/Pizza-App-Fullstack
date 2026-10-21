import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/shared/auth/session";
import { can, canManageUsers, type Access, type AnyModule, type Principal } from "./permissions";
import { getStaffUser, toPrincipal, type StaffUser } from "./repository";

export interface CurrentUser {
  user: StaffUser;
  principal: Principal;
}

/**
 * The signed-in, active user, loaded fresh from the database (once per request).
 * Returns null if there is no valid session, the account was deleted, or it was deactivated.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await getStaffUser(session.uid);
  if (!user || user.status !== "active") return null;
  return { user, principal: toPrincipal(user) };
});

/** For pages and actions: send to login if signed out, to the access-denied page if the module isn't allowed. */
export async function requireModule(module: AnyModule, need: Access = "view"): Promise<CurrentUser> {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.user.mustChangePassword) redirect("/change-password");
  if (!can(me.principal, module, need)) redirect("/access-denied");
  return me;
}

/** For server actions: same checks but throws instead of redirecting, so the caller can return an error. */
export async function assertCanManageUsers(): Promise<CurrentUser> {
  const me = await getCurrentUser();
  if (!me || !canManageUsers(me.principal)) throw new Error("FORBIDDEN");
  return me;
}
