import type { ReactNode } from "react";
import { requireModule } from "@/modules/access/current-user";

export default async function Layout({ children }: { children: ReactNode }) {
  await requireModule("customers");
  return children;
}
