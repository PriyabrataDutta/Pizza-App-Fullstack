"use client";

import { useActionState } from "react";
import { Button, Field, inputCls } from "@/shared/ui";
import { changePassword, type PasswordState } from "./actions";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, {});
  return (
    <form action={action} noValidate className="space-y-4 rounded-feature border border-line bg-surface p-5">
      <Field label="Current password">{(id) => <input id={id} name="current" type="password" autoComplete="current-password" required className={inputCls} />}</Field>
      <Field label="New password" hint="At least 10 characters.">{(id) => <input id={id} name="next" type="password" autoComplete="new-password" required className={inputCls} />}</Field>
      <Field label="Confirm new password">{(id) => <input id={id} name="confirm" type="password" autoComplete="new-password" required className={inputCls} />}</Field>
      {state.error && <p role="alert" className="rounded-control bg-error-soft px-3 py-2 text-sm text-error">{state.error}</p>}
      <Button type="submit" loading={pending} className="w-full">Save new password</Button>
    </form>
  );
}
