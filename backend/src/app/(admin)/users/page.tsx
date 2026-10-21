import { requireModule } from "@/modules/access/current-user";
import { listAudit, listStaffUsers } from "@/modules/access/repository";
import { UsersView } from "@/modules/access/users-view";

export const metadata = { title: "Users & Access · Crust & Co. Admin" };

export default async function UsersPage() {
  const me = await requireModule("users", "manage");
  const [users, audit] = await Promise.all([listStaffUsers(), listAudit(60)]);
  return <UsersView users={users} audit={audit} meId={me.user.id} />;
}
