import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { getCurrentUser } from "@/modules/access/current-user";
import { homePath } from "@/modules/access/permissions";
import { logout } from "@/shared/auth/actions";
import { Button } from "@/shared/ui";

export const metadata = { title: "No access · Crust & Co. Admin" };

export default async function AccessDeniedPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const home = homePath(me.principal);

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-feature border border-line bg-surface p-6 text-center">
        <LockKeyhole className="mx-auto size-9 text-ink-2" aria-hidden />
        <h1 className="mt-3 text-2xl font-bold">You don’t have access to this page</h1>
        <p className="mt-2 text-ink-2">
          {home
            ? "Your role doesn’t include this part of the dashboard. If you need it, ask a super admin to assign it to you."
            : "No modules have been assigned to your account yet. Ask a super admin to give you access."}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {home && <Link href={home}><Button>Go to my dashboard</Button></Link>}
          <form action={logout}><Button type="submit" variant="secondary">Sign out</Button></form>
        </div>
      </div>
    </main>
  );
}
