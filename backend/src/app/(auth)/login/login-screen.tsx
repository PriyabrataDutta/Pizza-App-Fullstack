"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { login, type LoginState } from "@/shared/auth/actions";
import { Pizza } from "@/components/pizza";
import { Button, Field, inputCls } from "@/shared/ui";

function LoginForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);

  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Staff email">
        {(id) => <input id={id} name="email" type="email" defaultValue={state.email} autoComplete="username" required className={inputCls} />}
      </Field>
      <Field label="Password">
        {(id) => (
          <div className="relative">
            <input id={id} name="password" type={show ? "text" : "password"} autoComplete="current-password" required className={`${inputCls} pr-12`} />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-pressed={show}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-0 top-0 grid size-11 place-items-center rounded-control text-ink-2 hover:text-ink"
            >
              {show ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
            </button>
          </div>
        )}
      </Field>
      {state.error && (
        <p role="alert" className="rounded-control bg-error-soft px-3 py-2 text-sm text-error">{state.error}</p>
      )}
      <Button type="submit" loading={pending} className="w-full text-base">Start your shift</Button>
    </form>
  );
}

export function LoginScreen() {
  return (
    <main className="gingham grid min-h-dvh place-items-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="relative pt-20">
          <Pizza className="pizza-in absolute left-1/2 top-0 z-10 size-40 -translate-x-1/2 drop-shadow-md" />

          <div className="ticket-wrap">
            <div className="ticket rounded-t-feature px-6 pb-7 pt-24">
              <div className="mb-5 text-center">
                <p className="text-sm font-semibold text-brand">Crust &amp; Co. Pizza House</p>
                <h1 className="mt-1 text-[28px] font-bold leading-tight">Staff sign in</h1>
                <p className="mt-1 text-ink-2">Sign in to see today’s orders.</p>
              </div>
              <Suspense>
                <LoginForm />
              </Suspense>
            </div>
          </div>
        </div>

        <p className="mx-auto mt-6 w-fit rounded-full bg-surface px-4 py-2 text-center text-[13px] text-ink-2">
          Staff only. Forgot your password? Ask your manager.
        </p>
      </div>
    </main>
  );
}
