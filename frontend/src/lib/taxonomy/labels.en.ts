/**
 * English labels and definitions of the theme taxonomies (T20 annotated, T11 projection).
 *
 * The frozen specification (`taxonomies.json`) carries French labels only. The public
 * reviewer page is English, so this dictionary is the single source of English wording;
 * codes are the keys and never change. A test checks that every code of the specification
 * has an entry here.
 */

export interface ThemeLabelEn {
  label: string;
  definition: string;
}

export const T20_EN: Record<string, ThemeLabelEn> = {
  META: { label: "Metadata, dates, addresses", definition: "Headers, effective dates, contact details, document titles." },
  PREAMBLE_SCOPE: { label: "Preamble and scope", definition: "Purpose of the agreement, scope, acceptance." },
  PRIVACY_DATA: { label: "Data and privacy", definition: "Collection and use of data, reference to the privacy policy." },
  ELIGIBILITY_ACCOUNT: { label: "Eligibility and account", definition: "Access conditions, age, account creation and security." },
  ACCEPTABLE_USE: { label: "Acceptable use", definition: "Prohibited behaviour, abuse, usage restrictions." },
  USER_CONTENT: { label: "User content", definition: "Content posted by the user and the rights granted over it." },
  LICENSE_IP: { label: "Licence and intellectual property", definition: "The provider's IP, licence to use the service or software." },
  MODIFICATION_OF_TERMS: { label: "Modification of terms", definition: "Right to change the terms or the service." },
  TERMINATION: { label: "Termination", definition: "Suspension or closure of the account or service." },
  WARRANTY_DISCLAIMER: { label: "Warranty disclaimer", definition: "Service provided “as is”, no warranties." },
  LIMITATION_LIABILITY: { label: "Limitation of liability", definition: "Caps and exclusions of liability and damages." },
  ARBITRATION_DISPUTES: { label: "Arbitration and disputes", definition: "Dispute resolution, arbitration, class-action waiver." },
  GOVERNING_LAW: { label: "Governing law", definition: "Applicable law and competent court." },
  THIRD_PARTY_SERVICES: { label: "Third-party services", definition: "Links, integrations, third-party services." },
  FEES_PAYMENT: { label: "Fees and payment", definition: "Prices, subscriptions, billing, refunds." },
  COMMUNICATIONS: { label: "Communications", definition: "Notices, e-mails, administrative communications." },
  FEEDBACK: { label: "Feedback", definition: "User suggestions and the rights over them." },
  PROMOTIONS: { label: "Promotions", definition: "Offers, contests, promo codes." },
  DMCA: { label: "DMCA and infringement", definition: "Infringement notices, takedown procedure." },
  MISC_BOILERPLATE: { label: "Miscellaneous boilerplate", definition: "Standard clauses: severability, entire agreement, assignment…" },
};

export const T11_EN: Record<string, ThemeLabelEn> = {
  FRAMEWORK: { label: "Contractual framework and communications", definition: "Everything that frames the agreement without creating a substantive obligation: purpose and scope, acceptance, headers and metadata, standard clauses, notices, promotional offers." },
  CONTENT_IP: { label: "Content, IP and notices", definition: "The regime of content and rights: the provider's licence on the service, the licence granted over user content, takedowns and infringement notices, rights over suggestions." },
  ACCOUNT_USE: { label: "Account access and use", definition: "Who may use the service and for what: access conditions, age, account creation and security, prohibited behaviour, usage restrictions." },
  DISPUTES_LAW: { label: "Disputes, arbitration and governing law", definition: "How disputes are settled: arbitration procedure, class-action waiver, competent court, applicable law." },
  PRIVACY_DATA: { label: "Data and privacy", definition: "Collection and use of data, reference to the privacy policy." },
  MODIFICATION_OF_TERMS: { label: "Modification of terms", definition: "Right to change the terms or the service unilaterally." },
  TERMINATION: { label: "Termination", definition: "Suspension and closure of the account or service, and their effects." },
  LIMITATION_LIABILITY: { label: "Limitation of liability", definition: "Caps and exclusions of liability and damages." },
  WARRANTY_DISCLAIMER: { label: "Warranty disclaimer", definition: "Service provided “as is”, no warranties." },
  THIRD_PARTY_SERVICES: { label: "Third-party services", definition: "Links, integrations and third-party services, and the associated liability." },
  FEES_PAYMENT: { label: "Fees and payment", definition: "Prices, subscriptions, billing, renewal, refunds." },
};

/** English label of a theme code in either taxonomy; falls back to the code itself. */
export function themeLabelEn(code: string | null | undefined): string {
  if (!code) return "—";
  return T11_EN[code]?.label ?? T20_EN[code]?.label ?? code;
}

export function themeDefinitionEn(code: string | null | undefined): string {
  if (!code) return "";
  return T11_EN[code]?.definition ?? T20_EN[code]?.definition ?? "";
}
