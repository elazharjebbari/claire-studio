/**
 * Règles de routage du triage — exprimées en CODES CANONIQUES de l'app.
 *
 * SOURCE DE VÉRITÉ HUMAINE : docs/pactiva/dossier-annotation-assistee/moteur/07-regles-routage.yaml
 * (codes au format protocole). Ce fichier en est la transposition exécutable, traduite
 * vers les codes canoniques du scheme app via le mapping réel de `normalize_theme_code`
 * (backend/claire/imports/theme_mapping.py) — car c'est ce que le moteur reçoit dans
 * `preByJudge`. Toute évolution = bump `version` + mise à jour conjointe du YAML.
 *
 * Réconciliation appliquée (protocole → app) :
 *   THIRD_PARTY→THIRD_PARTY_SERVICES · PAYMENT_BILLING→FEES_PAYMENT ·
 *   LIABILITY_LIMITATION→LIMITATION_LIABILITY · DISPUTE_ARBITRATION→ARBITRATION_DISPUTES ·
 *   DEFINITIONS→PREAMBLE_SCOPE (⚠ collapse vers un refuge — le scheme app n'a pas DEFINITIONS) ·
 *   INDEMNIFICATION→LIMITATION_LIABILITY · SUBSCRIPTION_RENEWAL→FEES_PAYMENT.
 * Conséquence : le cluster PAYMENT_BILLING↔SUBSCRIPTION_RENEWAL DÉGÉNÈRE (FEES_PAYMENT↔FEES_PAYMENT)
 * → retiré. Les 6 autres couples survivent.
 */

import type { Rules } from "./types";

export const RULES: Rules = {
  version: "1.0.0",

  // Refuges (codes app). DEFINITIONS collapse dans PREAMBLE_SCOPE en amont (cf. en-tête).
  refuges: ["PREAMBLE_SCOPE", "MISC_BOILERPLATE"],

  // Couples de cluster (codes app) — chevauchement juridique réel → multi-label.
  clusters: [
    ["LICENSE_IP", "USER_CONTENT"],
    ["ACCEPTABLE_USE", "LICENSE_IP"],
    ["ACCEPTABLE_USE", "USER_CONTENT"],
    ["LIMITATION_LIABILITY", "WARRANTY_DISCLAIMER"],
    ["ELIGIBILITY_ACCOUNT", "FEES_PAYMENT"],
    ["ACCEPTABLE_USE", "ELIGIBILITY_ACCOUNT"],
  ],

  // Préséance (la PI prime sur l'usage et le contenu).
  precedence: [
    { over: "LICENSE_IP", under: "USER_CONTENT" },
    { over: "LICENSE_IP", under: "ACCEPTABLE_USE" },
  ],

  // Priorité de repli (couvre les 20 codes app ; refuges en queue). DEFINITIONS étant
  // collapse dans PREAMBLE_SCOPE, il n'apparaît pas ; les codes app-only (DMCA,
  // COMMUNICATIONS, FEEDBACK, PROMOTIONS) sont insérés par substance décroissante.
  priority: [
    "ARBITRATION_DISPUTES",
    "GOVERNING_LAW",
    "LIMITATION_LIABILITY",
    "WARRANTY_DISCLAIMER",
    "DMCA",
    "LICENSE_IP",
    "USER_CONTENT",
    "PRIVACY_DATA",
    "FEES_PAYMENT",
    "ACCEPTABLE_USE",
    "ELIGIBILITY_ACCOUNT",
    "TERMINATION",
    "MODIFICATION_OF_TERMS",
    "THIRD_PARTY_SERVICES",
    "PROMOTIONS",
    "COMMUNICATIONS",
    "FEEDBACK",
    "META",
    "PREAMBLE_SCOPE",
    "MISC_BOILERPLATE",
  ],

  // κ binaire mesuré (3 juges) — pour l'explication, pas le routage. Codes app.
  reliabilityKappa: {
    ARBITRATION_DISPUTES: 0.73,
    FEES_PAYMENT: 0.57,
    WARRANTY_DISCLAIMER: 0.48,
    ELIGIBILITY_ACCOUNT: 0.47,
    LICENSE_IP: 0.47,
    USER_CONTENT: 0.45,
    MISC_BOILERPLATE: 0.27,
    META: 0.26,
    LIMITATION_LIABILITY: 0.24,
    PREAMBLE_SCOPE: 0.18,
  },

  // Alias bruts → canonique (miroir de normalize_theme_code ; identité sur canonique).
  // Sécurité si un code brut/protocole fuit jusqu'au moteur.
  themeAliases: {
    THIRD_PARTY: "THIRD_PARTY_SERVICES",
    PAYMENT_BILLING: "FEES_PAYMENT",
    LIABILITY_LIMITATION: "LIMITATION_LIABILITY",
    DISPUTE_ARBITRATION: "ARBITRATION_DISPUTES",
    DEFINITIONS: "PREAMBLE_SCOPE",
    INDEMNIFICATION: "LIMITATION_LIABILITY",
    SUBSCRIPTION_RENEWAL: "FEES_PAYMENT",
  },

  thresholds: { minJudges: 2 },
};
