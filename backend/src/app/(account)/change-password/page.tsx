import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/access/current-user";
import { ChangePasswordForm } from "./form";

export const metadata = { title: "Change password · Crust & Co. Admin" };

export default async function ChangePasswordPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-[28px] font-bold leading-tight">Change your password</h1>
        <p className="mt-1 mb-5 text-ink-2">
          {me.user.mustChangePassword ? "Choose your own password before you continue. The temporary one is only for your first sign-in." : "Pick a new password for your account."}
        </p>
        <ChangePasswordForm />
      </div>
    </main>
  );
}
