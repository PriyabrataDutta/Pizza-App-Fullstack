import "server-only";
import { randomBytes } from "node:crypto";
import { adminClient, anonClient } from "@/shared/supabase/server";
import type { Access, Grants, Module, Principal, Role } from "./permissions";

export interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: "active" | "inactive";
  mustChangePassword: boolean;
  createdAt: string;
  grants: Grants;
}

type Row = {
  id: string; full_name: string; email: string; role: Role; status: "active" | "inactive";
  must_change_password: boolean; created_at: string;
  user_modules?: { module: Module; access: Access }[];
};

const COLS = "id, full_name, email, role, status, must_change_password, created_at, user_modules(module, access)";

function toUser(r: Row): StaffUser {
  const grants: Grants = {};
  for (const m of r.user_modules ?? []) grants[m.module] = m.access;
  return { id: r.id, fullName: r.full_name, email: r.email, role: r.role, status: r.status, mustChangePassword: r.must_change_password, createdAt: r.created_at, grants };
}

export const toPrincipal = (u: StaffUser): Principal => ({ id: u.id, role: u.role, status: u.status, grants: u.grants });

export async function getStaffUser(id: string): Promise<StaffUser | null> {
  const { data, error } = await adminClient().from("staff_users").select(COLS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load user: ${error.message}`);
  return data ? toUser(data as unknown as Row) : null;
}

export async function listStaffUsers(): Promise<StaffUser[]> {
  const { data, error } = await adminClient().from("staff_users").select(COLS).order("created_at", { ascending: true });
  if (error) throw new Error(`Could not list users: ${error.message}`);
  return (data as unknown as Row[]).map(toUser);
}

export async function countActiveSuperAdmins(): Promise<number> {
  const { count, error } = await adminClient().from("staff_users").select("id", { count: "exact", head: true }).eq("role", "super_admin").eq("status", "active");
  if (error) throw new Error(`Could not count super admins: ${error.message}`);
  return count ?? 0;
}

/** Checks a password with Supabase Auth. Returns the user id, or null for any failure (no detail leaked). */
export async function verifyPassword(email: string, password: string): Promise<string | null> {
  const { data, error } = await anonClient().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  return error || !data.user ? null : data.user.id;
}

/** 16 random characters, shown once to the super admin. The user must change it at first login. */
export function temporaryPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export interface NewUser { fullName: string; email: string; role: Role; grants: Grants; createdBy: string }

export async function createStaffUser(input: NewUser): Promise<{ user: StaffUser; password: string }> {
  const sb = adminClient();
  const password = temporaryPassword();
  const email = input.email.trim().toLowerCase();

  const created = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) {
    const msg = created.error?.message ?? "unknown error";
    throw new RepoError(/already|registered|exists/i.test(msg) ? "EMAIL_TAKEN" : "AUTH_FAILED", msg);
  }
  const id = created.data.user.id;

  const profile = await sb.from("staff_users").insert({ id, full_name: input.fullName.trim(), email, role: input.role, created_by: input.createdBy });
  if (profile.error) {
    await sb.auth.admin.deleteUser(id); // don't leave an orphan login behind
    throw new RepoError("DB_FAILED", profile.error.message);
  }
  await replaceGrants(id, input.role === "super_admin" ? {} : input.grants);
  const user = await getStaffUser(id);
  if (!user) throw new RepoError("DB_FAILED", "User was created but could not be read back.");
  return { user, password };
}

export async function replaceGrants(userId: string, grants: Grants): Promise<void> {
  const sb = adminClient();
  const del = await sb.from("user_modules").delete().eq("user_id", userId);
  if (del.error) throw new RepoError("DB_FAILED", del.error.message);
  const rows = Object.entries(grants).map(([module, access]) => ({ user_id: userId, module, access }));
  if (rows.length) {
    const ins = await sb.from("user_modules").insert(rows);
    if (ins.error) throw new RepoError("DB_FAILED", ins.error.message);
  }
}

export async function updateStaffProfile(id: string, patch: { fullName?: string; role?: Role; status?: "active" | "inactive"; mustChangePassword?: boolean }): Promise<void> {
  const sb = adminClient();
  const update: Record<string, unknown> = {};
  if (patch.fullName !== undefined) update.full_name = patch.fullName.trim();
  if (patch.role !== undefined) update.role = patch.role;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.mustChangePassword !== undefined) update.must_change_password = patch.mustChangePassword;
  const { error } = await sb.from("staff_users").update(update).eq("id", id);
  if (error) throw new RepoError(/LAST_SUPER_ADMIN/.test(error.message) ? "LAST_SUPER_ADMIN" : "DB_FAILED", error.message);

  if (patch.status !== undefined) {
    // Inactive users can't sign in even if they somehow keep a cookie: the session check reads status each request.
    await sb.auth.admin.updateUserById(id, { ban_duration: patch.status === "inactive" ? "876000h" : "none" });
  }
}

export async function setPassword(id: string, password: string): Promise<void> {
  const { error } = await adminClient().auth.admin.updateUserById(id, { password });
  if (error) throw new RepoError("AUTH_FAILED", error.message);
}

export async function deleteStaffUser(id: string): Promise<void> {
  // Deleting the auth user cascades to staff_users and user_modules.
  const { error } = await adminClient().auth.admin.deleteUser(id);
  if (error) throw new RepoError(/LAST_SUPER_ADMIN/.test(error.message) ? "LAST_SUPER_ADMIN" : "AUTH_FAILED", error.message);
}

export interface AuditEntry { id: string; actorEmail: string | null; action: string; targetEmail: string | null; details: Record<string, unknown>; createdAt: string }

export async function writeAudit(e: { actorId: string; actorEmail: string; action: string; targetId?: string; targetEmail?: string; details?: Record<string, unknown> }): Promise<void> {
  const { error } = await adminClient().from("audit_log").insert({
    actor_id: e.actorId, actor_email: e.actorEmail, action: e.action,
    target_id: e.targetId ?? null, target_email: e.targetEmail ?? null, details: e.details ?? {},
  });
  if (error) console.error("audit_log write failed", error.message); // never block the action on logging, but do surface it
}

export async function listAudit(limit = 50): Promise<AuditEntry[]> {
  const { data, error } = await adminClient().from("audit_log").select("id, actor_email, action, target_email, details, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Could not load activity: ${error.message}`);
  return data.map((r) => ({ id: r.id, actorEmail: r.actor_email, action: r.action, targetEmail: r.target_email, details: r.details ?? {}, createdAt: r.created_at }));
}

export class RepoError extends Error {
  constructor(public code: "EMAIL_TAKEN" | "AUTH_FAILED" | "DB_FAILED" | "LAST_SUPER_ADMIN", message: string) {
    super(message);
  }
}
