// The business details every legal page is built from. To go live: replace each value here, set `placeholder` to false, settle every
// [bracketed decision] in content.ts, and have the pages checked by a lawyer. While `placeholder` is true every page shows a warning
// banner saying it is a draft; once it is false, the tests fail until no dummy value or open decision is left.
//
// All values below are DUMMY (Platzhalter). They are not real and must not be relied on.

export interface BusinessDetails {
  /** True while the values below are made up. Shows the draft warning on every legal page. Once it is false, the tests fail while any "Platzhalter" or unresolved [decision] is still in the text. */
  placeholder: boolean;
  brand: string;
  legalName: string;
  representative: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  vatId: string;
  register: string;
  /** Responsible for content under § 18 Abs. 2 MStV. */
  responsible: string;
  supervisoryAuthority: string;
  /** Date shown as "Stand" on the pages. */
  updated: string;
}

export const business: BusinessDetails = {
  placeholder: true,
  brand: "Crust & Co. Pizza House",
  legalName: "Crust & Co. Pizza House GmbH (Platzhalter)",
  representative: "Max Mustermann (Platzhalter)",
  street: "Musterstraße 1",
  postalCode: "46483",
  city: "Wesel",
  country: "Deutschland",
  email: "info@example.com",
  phone: "+49 281 000000",
  vatId: "DE000000000 (Platzhalter)",
  register: "Amtsgericht Duisburg, HRB 00000 (Platzhalter)",
  responsible: "Max Mustermann (Platzhalter), Anschrift wie oben",
  supervisoryAuthority: "Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen (zuständige Behörde bitte prüfen)",
  updated: "28.10.2026",
};

/** The same address on one line. */
export const addressLine = (b: BusinessDetails) => `${b.street}, ${b.postalCode} ${b.city}, ${b.country}`;
