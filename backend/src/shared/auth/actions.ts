"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStaffUser, toPrincipal, verifyPassword, writeAudit } from "@/modules/access/repository";
import { homePath } from "@/modules/access/permissions";
import { allowShared } from "./shared-limit";
import { clearFailures, isIpLocked, isLocked, recordFailure, recordIpFailure } from "./rate-limit";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "./session";

export interface LoginState {
  error?: string;
  /** Echoed back so the form can keep what the user typed. */
  email?: string;
}

/** Only allow same-site relative paths as post-login targets. */
function safeNext(next: FormDataEntryValue | null): string | null {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : null;
}

const BAD_LOGIN = "That email and password don’t match. Check them and try again.";

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email.includes("@") || !password) return { error: "Enter your staff email and password.", email };

  const h = await headers();
  const ip = h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isIpLocked(ip)) return { error: "Too many failed attempts from this connection. Wait 15 minutes and try again.", email };
  if (isLocked(email)) return { error: "Too many failed attempts. Wait 15 minutes and try again.", email };

  // The same limits, counted where every server instance can see them (the counters above are per instance). Attempts, not only
  // failures, are counted: a staff member signs in a few times a day, never ten times in a quarter of an hour.
  const quarter = 15 * 60 * 1000;
  if (!(await allowShared(`login-ip:${ip}`, 60, quarter))) return { error: "Too many sign-in attempts from this connection. Wait 15 minutes and try again.", email };
  if (!(await allowShared(`login-email:${email.toLowerCase()}`, 10, quarter))) return { error: "Too many sign-in attempts. Wait 15 minutes and try again.", email };

  const uid = await verifyPassword(email, password);
  const user = uid ? await getStaffUser(uid) : null;

  // Same message for wrong password, unknown email, and deactivated account: don't reveal which.
  if (!uid || !user || user.status !== "active") {
    recordFailure(email);
    recordIpFailure(ip);
    return { error: BAD_LOGIN, email };
  }

  clearFailures(email);
  (await cookies()).set(SESSION_COOKIE, await signSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  await writeAudit({ actorId: user.id, actorEmail: user.email, action: "login" });

  if (user.mustChangePassword) redirect("/change-password");
  redirect(safeNext(form.get("next")) ?? homePath(toPrincipal(user)) ?? "/access-denied");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
