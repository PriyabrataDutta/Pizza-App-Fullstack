import type { Metadata } from "next";
import { business } from "@/modules/legal/business";
import { datenschutz } from "@/modules/legal/content";
import { LegalPage } from "@/modules/legal/legal-page";

export const metadata: Metadata = { title: `Datenschutzerklärung · ${business.brand}` };

export default function Page() {
  return <LegalPage doc={datenschutz(business)} />;
}
