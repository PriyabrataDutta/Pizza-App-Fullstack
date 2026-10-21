"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/access/current-user";
import { homePath } from "@/modules/access/permissions";
import { setPassword, updateStaffProfile, verifyPassword, writeAudit } from "@/modules/access/repository";

export interface PasswordState {
  error?: string;
}

const MIN_LENGTH = 10;

export async function changePassword(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (!current || !next) return { error: "Fill in every field." };
  if (next.length < MIN_LENGTH) return { error: `Use at least ${MIN_LENGTH} characters for the new password.` };
  if (next !== confirm) return { error: "The new passwords don’t match." };
  if (next === current) return { error: "Choose a password you haven’t used for this account." };

  if (!(await verifyPassword(me.user.email, current))) return { error: "Your current password isn’t right." };

  await setPassword(me.user.id, next);
  await updateStaffProfile(me.user.id, { mustChangePassword: false });
  await writeAudit({ actorId: me.user.id, actorEmail: me.user.email, action: "password_changed", targetId: me.user.id, targetEmail: me.user.email });

  redirect(homePath(me.principal) ?? "/access-denied");
}
