import { requireModule } from "@/modules/access/current-user";
import { OverviewView } from "@/modules/ordering/overview-view";

export default async function OverviewPage() {
  await requireModule("overview");
  return <OverviewView />;
}
