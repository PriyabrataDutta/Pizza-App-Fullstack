import type { Metadata } from "next";
import { business } from "@/modules/legal/business";
import { impressum } from "@/modules/legal/content";
import { LegalPage } from "@/modules/legal/legal-page";

export const metadata: Metadata = { title: `Impressum · ${business.brand}` };

export default function Page() {
  return <LegalPage doc={impressum(business)} />;
}
