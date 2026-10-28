import { describe, expect, it } from "vitest";
import { business, addressLine, type BusinessDetails } from "./business";
import { agb, datenschutz, impressum, type LegalDocument } from "./content";

const text = (doc: LegalDocument) => [doc.title, doc.intro ?? "", ...doc.sections.flatMap((s) => [s.heading, ...s.paragraphs])].join("\n");

/** What would still be wrong if these pages were published: made-up values and decisions nobody has taken. */
export const leftovers = (doc: LegalDocument) => [...(text(doc).match(/Platzhalter|\[[^\]]+\]/g) ?? [])];

const real: BusinessDetails = {
  placeholder: false, brand: "Pizza Beispiel", legalName: "Pizza Beispiel GmbH", representative: "Erika Beispiel", street: "Hauptstraße 5", postalCode: "46483",
  city: "Wesel", country: "Deutschland", email: "kontakt@pizza-beispiel.de", phone: "+49 281 123456", vatId: "DE123456789", register: "AG Duisburg, HRB 12345",
  responsible: "Erika Beispiel, Anschrift wie oben", supervisoryAuthority: "LDI NRW", updated: "01.01.2027",
};

describe("legal pages", () => {
  it("the imprint carries every detail a visitor must be able to find", () => {
    const t = text(impressum(real));
    for (const v of [real.legalName, addressLine(real), real.email, real.phone, real.vatId, real.register, real.representative]) expect(t).toContain(v);
  });

  it("the privacy policy names the controller, the processors, the rights and the authority", () => {
    const t = text(datenschutz(real));
    for (const v of [real.legalName, real.email, "Supabase", "Vercel", "Art. 15", "Art. 17", real.supervisoryAuthority]) expect(t).toContain(v);
  });

  it("the terms state the points a buyer expects: when the contract is made, prices, payment, no withdrawal right", () => {
    const t = text(agb(real));
    for (const v of ["Vertrag kommt zustande", "Umsatzsteuer", "in bar bei Lieferung", "kein Widerrufsrecht", "ab 18 Jahren"]) expect(t).toContain(v);
  });

  it("never promises what the system does not do", () => {
    const t = text(datenschutz(real)) + text(agb(real));
    expect(t).not.toMatch(/Kreditkarte|PayPal|Online-Zahlung wird angeboten|Standortdaten|Newsletter/);
    expect(t).toContain("Online-Zahlung wird derzeit nicht angeboten");
  });

  it("the leftovers check sees dummy values and open decisions", () => {
    expect(leftovers(impressum(business)).length).toBeGreaterThan(0);
    expect(leftovers(agb(real))).toContain("[Stand der Mindestbestellwerte und Liefergebiete vor dem Start prüfen.]");
  });

  it("RELEASE GUARD: once the details are real (placeholder = false), no dummy value or open decision may remain in any page", () => {
    if (business.placeholder) return; // still a draft: the pages say so on screen
    for (const doc of [impressum(business), datenschutz(business), agb(business)]) expect(leftovers(doc), doc.title).toEqual([]);
  });
});
