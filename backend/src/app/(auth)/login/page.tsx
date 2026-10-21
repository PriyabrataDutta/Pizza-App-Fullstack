import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/access/current-user";
import { homePath } from "@/modules/access/permissions";
import { LoginScreen } from "./login-screen";

export const metadata = { title: "Sign in · Crust & Co. Admin" };

export default async function LoginPage() {
  // Already signed in with an active account: skip the form.
  const me = await getCurrentUser();
  if (me) redirect(me.user.mustChangePassword ? "/change-password" : (homePath(me.principal) ?? "/access-denied"));
  return <LoginScreen />;
}
