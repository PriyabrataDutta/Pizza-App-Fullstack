import { addressLine, type BusinessDetails } from "./business";

// The text of the three legal pages, in German, built from the business details. A template: the structure follows what a small food
// delivery business usually needs, but it is NOT legal advice and must be checked by a lawyer before launch. Square brackets mark the
// places where the business has to decide something.

export interface Section {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocument {
  title: string;
  intro?: string;
  sections: Section[];
}

export const DRAFT_NOTICE =
  "Entwurf mit Beispielangaben. Diese Seite ist noch nicht rechtsgültig: Die Angaben sind erfunden und der Text ist nicht rechtlich geprüft. Vor dem Start mit den echten Angaben füllen und prüfen lassen.";

export function impressum(b: BusinessDetails): LegalDocument {
  return {
    title: "Impressum",
    sections: [
      { heading: "Angaben gemäß § 5 DDG", paragraphs: [b.legalName, addressLine(b), `Vertreten durch: ${b.representative}`] },
      { heading: "Kontakt", paragraphs: [`Telefon: ${b.phone}`, `E-Mail: ${b.email}`] },
      { heading: "Registereintrag", paragraphs: [b.register] },
      { heading: "Umsatzsteuer-Identifikationsnummer", paragraphs: [`Umsatzsteuer-ID gemäß § 27a Umsatzsteuergesetz: ${b.vatId}`] },
      { heading: "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV", paragraphs: [b.responsible] },
      {
        heading: "Verbraucherstreitbeilegung",
        paragraphs: ["[Entscheidung des Betreibers einsetzen: Bereitschaft oder Nichtbereitschaft zur Teilnahme an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle nach § 36 VSBG.]"],
      },
    ],
  };
}

export function datenschutz(b: BusinessDetails): LegalDocument {
  return {
    title: "Datenschutzerklärung",
    intro: `Hier erfahren Sie, welche personenbezogenen Daten ${b.brand} bei Nutzung der App und beim Bestellen verarbeitet, wozu, und welche Rechte Sie haben. Stand: ${b.updated}.`,
    sections: [
      { heading: "1. Verantwortlicher", paragraphs: [`${b.legalName}, ${addressLine(b)}`, `E-Mail: ${b.email}, Telefon: ${b.phone}`] },
      {
        heading: "2. Welche Daten wir verarbeiten",
        paragraphs: [
          "Bei einer Bestellung: Ihr Name, Ihre Telefonnummer, Ihre Lieferadresse (Straße, Ortsteil, Ort, Postleitzahl), Hinweise zur Lieferung, die bestellten Speisen und Getränke, Zahlungsart (Barzahlung), Gutscheincode sowie Zeitpunkt und Status der Bestellung.",
          "Bei der Nutzung der App: eine zufällig erzeugte Gerätekennung (Token), die Ihre Bestellungen auf diesem Gerät zuordnet. Sie wird auf unseren Servern nur als Prüfwert (Hash) gespeichert, nicht im Klartext. Die App-Version wird bei Anfragen mitgesendet.",
          "Beim Aufruf unserer Server: technisch notwendige Daten wie IP-Adresse, Zeitpunkt und aufgerufene Funktion (Server-Protokolle).",
          "Wir verwenden keine Werbe- oder Analyse-Dienste und kein Tracking in der App.",
        ],
      },
      {
        heading: "3. Zwecke und Rechtsgrundlagen",
        paragraphs: [
          "Annahme, Zubereitung, Lieferung und Abrechnung Ihrer Bestellung: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung). Ohne Name, Telefonnummer und Adresse können wir nicht liefern.",
          "Aufbewahrung von Bestellungen für Buchführung und Steuer: Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung).",
          "Sicherheit und Missbrauchsschutz, zum Beispiel Begrenzung von Anfragen und Schutz vor Fantasiebestellungen: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse).",
        ],
      },
      {
        heading: "4. Empfänger und Dienstleister",
        paragraphs: [
          "Datenbank und Dateispeicher: Supabase (Server in Frankfurt am Main, EU) als Auftragsverarbeiter.",
          "Betrieb der Server-Funktionen: Vercel als Auftragsverarbeiter. [Prüfen: Sitz in den USA, Übermittlung auf Grundlage des EU-US Data Privacy Framework oder von Standardvertragsklauseln; Funktionen laufen in Frankfurt.]",
          "Interne Bestellbenachrichtigung des Restaurants über Telegram, falls aktiviert: Name, Telefonnummer, Adresse und Inhalt der Bestellung gehen an eine geschlossene Gruppe des Restaurants. [Nur belassen, wenn genutzt; Auftragsverarbeitung und Drittland prüfen.]",
          "Unsere Fahrerinnen und Fahrer erhalten die Daten, die sie zur Lieferung benötigen.",
          "Eine Weitergabe zu Werbezwecken findet nicht statt.",
        ],
      },
      {
        heading: "5. Speicherdauer",
        paragraphs: [
          "Bestelldaten bewahren wir so lange auf, wie es das Handels- und Steuerrecht verlangt (derzeit bis zu 10 Jahre, § 147 AO, § 257 HGB), und löschen sie danach.",
          "Gerätekennung und Adressen ohne Bestellung: [Löschfrist festlegen, zum Beispiel 12 Monate ohne Nutzung].",
          "Server-Protokolle: [Frist festlegen, zum Beispiel 30 Tage].",
        ],
      },
      {
        heading: "6. Ihre Rechte",
        paragraphs: [
          "Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21).",
          `Wenden Sie sich dafür an ${b.email}. Sie haben außerdem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, zum Beispiel: ${b.supervisoryAuthority}.`,
        ],
      },
      {
        heading: "7. Keine automatisierte Entscheidung",
        paragraphs: ["Eine ausschließlich automatisierte Entscheidungsfindung einschließlich Profiling im Sinne von Art. 22 DSGVO findet nicht statt."],
      },
      {
        heading: "8. Cookies",
        paragraphs: ["Die App verwendet keine Cookies. Die Verwaltungsoberfläche für Mitarbeitende setzt ein technisch notwendiges Anmelde-Cookie; es dient nur der Anmeldung und enthält keine Tracking-Informationen."],
      },
    ],
  };
}

export function agb(b: BusinessDetails): LegalDocument {
  return {
    title: "Allgemeine Geschäftsbedingungen (Bestellung über die App)",
    intro: `Diese Bedingungen gelten für Bestellungen bei ${b.legalName} über die App. Stand: ${b.updated}.`,
    sections: [
      { heading: "1. Anbieter", paragraphs: [`${b.legalName}, ${addressLine(b)}, ${b.email}, ${b.phone}.`] },
      {
        heading: "2. Vertragsschluss",
        paragraphs: [
          "Die Darstellung der Speisekarte in der App ist kein verbindliches Angebot. Mit dem Antippen der Schaltfläche zum Bestellen geben Sie ein verbindliches Angebot zum Kauf der Waren im Warenkorb ab. Der Vertrag kommt zustande, wenn wir Ihre Bestellung annehmen; Sie sehen das am Status Ihrer Bestellung in der App. Wir können Bestellungen ablehnen, zum Beispiel wenn eine Ware nicht verfügbar ist.",
        ],
      },
      {
        heading: "3. Preise",
        paragraphs: [
          "Alle Preise sind Endpreise in Euro und enthalten die gesetzliche Umsatzsteuer. Zusätzliche Lieferkosten fallen derzeit nicht an. Für die Lieferung gilt je Liefergebiet ein Mindestbestellwert, der Ihnen in der App angezeigt wird. [Stand der Mindestbestellwerte und Liefergebiete vor dem Start prüfen.]",
        ],
      },
      {
        heading: "4. Lieferung",
        paragraphs: [
          "Wir liefern in die in der App angezeigten Liefergebiete. Die angegebene Lieferzeit ist eine voraussichtliche Zeit und nicht verbindlich. Bitte sorgen Sie dafür, dass Sie unter der angegebenen Telefonnummer erreichbar sind.",
        ],
      },
      { heading: "5. Zahlung", paragraphs: ["Die Zahlung erfolgt in bar bei Lieferung. Eine Online-Zahlung wird derzeit nicht angeboten."] },
      {
        heading: "6. Gutscheine",
        paragraphs: ["Gutscheincodes gelten nur für die angegebenen Bedingungen (zum Beispiel Mindestbestellwert, Gültigkeitszeitraum, Einlösegrenzen) und werden bei der Bestellung geprüft. Sie sind nicht auszahlbar."],
      },
      {
        heading: "7. Kein Widerrufsrecht",
        paragraphs: [
          "Bei Speisen und Getränken, die schnell verderben können oder nach Ihren Wünschen zubereitet werden, besteht kein Widerrufsrecht (§ 312g Abs. 2 Nr. 1 und 2 BGB). [Von Juristen prüfen lassen und die vorgeschriebenen Informationen ergänzen.]",
        ],
      },
      {
        heading: "8. Stornierung",
        paragraphs: ["Eine Bestellung kann nur durch uns storniert werden, zum Beispiel wenn Waren nicht verfügbar sind. Rufen Sie uns bei Fragen an."],
      },
      {
        heading: "9. Alkohol",
        paragraphs: ["Alkoholische Getränke geben wir nur an Personen ab 18 Jahren und nur zur Abholung ab."],
      },
      {
        heading: "10. Allergene und Zusatzstoffe",
        paragraphs: ["[Hinweis zur Information über Allergene und Zusatzstoffe nach der Lebensmittelinformations-Verordnung einsetzen, zum Beispiel: Auskunft auf Anfrage und Aushang im Restaurant.]"],
      },
      {
        heading: "11. Mängel und Haftung",
        paragraphs: ["Bei Mängeln gelten die gesetzlichen Regeln. Unsere Haftung richtet sich nach den gesetzlichen Vorschriften; [Haftungsregelung prüfen lassen]."],
      },
      { heading: "12. Anwendbares Recht", paragraphs: ["Es gilt deutsches Recht. Zwingende Verbraucherschutzvorschriften Ihres Aufenthaltsstaats bleiben unberührt."] },
    ],
  };
}
