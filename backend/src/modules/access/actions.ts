"use server";

import { revalidatePath } from "next/cache";
import { assertCanManageUsers } from "./current-user";
import { ROLES, checkUserChange, sanitizeGrants, type Role } from "./permissions";
import {
  RepoError, countActiveSuperAdmins, createStaffUser, deleteStaffUser, getStaffUser, replaceGrants, setPassword,
  temporaryPassword, updateStaffProfile, writeAudit,
} from "./repository";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function guard() {
  try {
    return await assertCanManageUsers();
  } catch {
    return null;
  }
}
const FORBIDDEN = { ok: false, error: "Only a super admin can manage users." } as const;

function validateBasics(fullName: unknown, role: unknown): string | null {
  if (typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 80) return "Enter a name up to 80 characters.";
  if (typeof role !== "string" || !(ROLES as readonly string[]).includes(role)) return "Choose a role.";
  return null;
}

function repoMessage(e: unknown): string {
  if (e instanceof RepoError) {
    if (e.code === "EMAIL_TAKEN") return "A user with this email already exists.";
    if (e.code === "LAST_SUPER_ADMIN") return "This is the last active super admin. Create another one first.";
  }
  console.error("user action failed", e instanceof Error ? e.message : e);
  return "Something went wrong and nothing was saved. Try again.";
}

export async function createUserAction(input: { fullName: string; email: string; role: Role; grants: unknown }): Promise<ActionResult<{ password: string; email: string }>> {
  const me = await guard();
  if (!me) return FORBIDDEN;

  const bad = validateBasics(input.fullName, input.role);
  if (bad) return { ok: false, error: bad };
  if (typeof input.email !== "string" || !EMAIL.test(input.email.trim())) return { ok: false, error: "Enter a valid email address." };
  const g = sanitizeGrants(input.role, input.grants);
  if (!g.ok) return { ok: false, error: g.errors[0] };

  try {
    const { user, password } = await createStaffUser({ fullName: input.fullName, email: input.email, role: input.role, grants: g.grants, createdBy: me.user.id });
    await writeAudit({ actorId: me.user.id, actorEmail: me.user.email, action: "user_created", targetId: user.id, targetEmail: user.email, details: { role: user.role, grants: user.grants } });
    revalidatePath("/users");
    return { ok: true, password, email: user.email };
  } catch (e) {
    return { ok: false, error: repoMessage(e) };
  }
}

export async function updateUserAction(id: string, input: { fullName: string; role: Role; status: "active" | "inactive"; grants: unknown }): Promise<ActionResult> {
  const me = await guard();
  if (!me) return FORBIDDEN;

  const bad = validateBasics(input.fullName, input.role);
  if (bad) return { ok: false, error: bad };
  if (input.status !== "active" && input.status !== "inactive") return { ok: false, error: "Choose a status." };
  const g = sanitizeGrants(input.role, input.grants);
  if (!g.ok) return { ok: false, error: g.errors[0] };

  const target = await getStaffUser(id);
  if (!target) return { ok: false, error: "This user no longer exists." };

  const roleChanged = target.role !== input.role;
  const statusChanged = target.status !== input.status;
  const superAdmins = await countActiveSuperAdmins();

  if (me.user.id === target.id && (roleChanged || statusChanged)) {
    return { ok: false, error: roleChanged ? "You can’t change your own role." : "You can’t deactivate your own account." };
  }
  if (target.role === "super_admin" && roleChanged) {
    const c = checkUserChange(me.principal, target, "demote", superAdmins);
    if (!c.ok) return { ok: false, error: c.reason! };
  }
  if (statusChanged && input.status === "inactive") {
    const c = checkUserChange(me.principal, target, "deactivate", superAdmins);
    if (!c.ok) return { ok: false, error: c.reason! };
  }

  try {
    await updateStaffProfile(id, { fullName: input.fullName, role: input.role, status: input.status });
    await replaceGrants(id, g.grants);
    await writeAudit({
      actorId: me.user.id, actorEmail: me.user.email, action: "user_updated", targetId: id, targetEmail: target.email,
      details: { from: { role: target.role, status: target.status, grants: target.grants }, to: { role: input.role, status: input.status, grants: g.grants } },
    });
    revalidatePath("/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: repoMessage(e) };
  }
}

export async function resetPasswordAction(id: string): Promise<ActionResult<{ password: string; email: string }>> {
  const me = await guard();
  if (!me) return FORBIDDEN;
  const target = await getStaffUser(id);
  if (!target) return { ok: false, error: "This user no longer exists." };
  try {
    const password = temporaryPassword();
    await setPassword(id, password);
    await updateStaffProfile(id, { mustChangePassword: true });
    await writeAudit({ actorId: me.user.id, actorEmail: me.user.email, action: "password_reset", targetId: id, targetEmail: target.email });
    revalidatePath("/users");
    return { ok: true, password, email: target.email };
  } catch (e) {
    return { ok: false, error: repoMessage(e) };
  }
}

export async function deleteUserAction(id: string): Promise<ActionResult> {
  const me = await guard();
  if (!me) return FORBIDDEN;
  const target = await getStaffUser(id);
  if (!target) return { ok: false, error: "This user no longer exists." };

  const c = checkUserChange(me.principal, target, "delete", await countActiveSuperAdmins());
  if (!c.ok) return { ok: false, error: c.reason! };

  try {
    await deleteStaffUser(id);
    await writeAudit({ actorId: me.user.id, actorEmail: me.user.email, action: "user_deleted", targetId: id, targetEmail: target.email, details: { role: target.role } });
    revalidatePath("/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: repoMessage(e) };
  }
}
