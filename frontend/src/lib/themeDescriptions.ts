/**
 * Descriptions courtes des thèmes de segmentation (vocabulaire fermé).
 *
 * Source : `content/help/themes-segmentation.md` (colonne « La clause traite de… »),
 * la documentation annotateur déjà présente — pour que l'info-bulle au survol soit
 * précise et cohérente avec le guide. Affichées en info-bulle (délai d'intention) dans
 * la palette de thèmes du menu clic-droit.
 */

export const THEME_DESCRIPTIONS: Record<string, string> = {
  META: "En-têtes, dates d'effet, coordonnées, titres de document.",
  PREAMBLE_SCOPE: "Objet du contrat, périmètre, acceptation.",
  PRIVACY_DATA: "Collecte/usage des données, renvoi à la politique de confidentialité.",
  ELIGIBILITY_ACCOUNT: "Conditions d'accès, âge, création/sécurité du compte.",
  ACCEPTABLE_USE: "Comportements interdits, abus, restrictions d'usage.",
  USER_CONTENT: "Contenu posté par l'utilisateur, droits/licences accordés dessus.",
  LICENSE_IP: "Propriété intellectuelle du fournisseur, licence d'usage du service/logiciel.",
  MODIFICATION_OF_TERMS: "Droit de modifier les CGU ou le service.",
  TERMINATION: "Suspension/clôture du compte ou du service.",
  WARRANTY_DISCLAIMER: "Service fourni « en l'état », absence de garanties.",
  LIMITATION_LIABILITY: "Plafonds/exclusions de responsabilité et de dommages.",
  ARBITRATION_DISPUTES:
    "Résolution des litiges, arbitrage, renonciation à l'action collective.",
  GOVERNING_LAW: "Loi applicable et/ou tribunal compétent.",
  THIRD_PARTY_SERVICES: "Liens, intégrations, services de tiers.",
  FEES_PAYMENT: "Prix, abonnements, facturation, remboursements.",
  COMMUNICATIONS: "Notifications, e-mails, communications administratives.",
  FEEDBACK: "Suggestions/retours de l'utilisateur et droits dessus.",
  PROMOTIONS: "Offres, concours, codes promo.",
  DMCA: "Signalement de contrefaçon, procédure de retrait.",
  MISC_BOILERPLATE:
    "Clauses standard non spécifiques (divisibilité, intégralité, cession…).",
};

/** Description courte d'un thème (chaîne vide si inconnue). */
export function getThemeDescription(code: string | null | undefined): string {
  return (code && THEME_DESCRIPTIONS[code]) || "";
}
