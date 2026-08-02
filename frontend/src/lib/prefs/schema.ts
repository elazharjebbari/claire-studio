/**
 * Préférences d'interface PAR COMPTE (couche « compte / comportement ») — schéma pur,
 * versionné, fusionné aux défauts. Sans React, testable isolément.
 *
 * Principe (dossier docs/pactiva/dossier-preferences-compte) : un SEUL objet `uiPrefs`
 * stocké côté serveur (User.ui_preferences, camelCase via drf-camel-case) ; toute lecture
 * passe par `mergeUiPrefs(DEFAULTS, serverPrefs)` ⇒ un champ absent/inconnu retombe sur le
 * défaut (robuste à l'évolution des juges et aux renommages doux). Les ids de modèle
 * (`prefill.judge`, `llmSource`, clés de `ghostJudges`) sont LIBRES — jamais des enums figées
 * — donc l'ajout/retrait d'un juge n'invalide jamais une préférence ni ne requiert de migration.
 *
 * NB : la couche SHELL/poste (theme, density, zoom, largeurs, gutter*) reste en localStorage
 * (useUiStore) et N'EST PAS dans ce schéma — ces réglages dépendent de l'écran, pas du compte.
 */

import { DEFAULT_LLM_JUDGE } from "@/lib/llmJudges";

export const UI_PREFS_SCHEMA_VERSION = 1;

export type DisplayLang = "orig" | "both" | "fr";
const DISPLAY_LANGS: DisplayLang[] = ["orig", "both", "fr"];

export interface UiPrefsOverlays {
  /** Surlignage injustice CLAUDETTE (défaut visible). */
  showUnfairness: boolean;
  /** Langue d'affichage du document. */
  displayLang: DisplayLang;
  /** Source de segmentation affichée : "human" | "compare" | id de juge (LIBRE). */
  llmSource: string;
}

export interface UiPrefsPanels {
  /** Barre latérale de l'APPLICATION (shell nav) repliée. */
  inspectorOpen: boolean;
  sidebarCollapsed: boolean;
  /** Panneau PLAN de l'atelier replié (distinct de la sidebar de l'app — anti-collision). */
  planCollapsed: boolean;
  historyOpen: boolean;
  commentsOpen: boolean;
  triageOpen: boolean;
  /** Barre de contrôles du document repliée (gain de place sur petits écrans). */
  docControlsCollapsed: boolean;
}

export interface UiPrefsPrefill {
  /** Auto-exécution du pré-remplissage à l'ouverture d'un document VIERGE. */
  enabled: boolean;
  /** Modèle armé (id de juge LIBRE) ou null. */
  judge: string | null;
  /** La modale de 1ère demande a-t-elle déjà été montrée ? (ne se remontre jamais). */
  asked: boolean;
}

export interface UiPrefsV1 {
  v: number;
  overlays: UiPrefsOverlays;
  /** Map id de juge → fantôme visible. Ids LIBRES. */
  ghostJudges: Record<string, boolean>;
  panels: UiPrefsPanels;
  prefill: UiPrefsPrefill;
}

export const UI_PREFS_DEFAULTS: UiPrefsV1 = {
  v: UI_PREFS_SCHEMA_VERSION,
  overlays: { showUnfairness: true, displayLang: "orig", llmSource: "human" },
  ghostJudges: {},
  panels: {
    inspectorOpen: true,
    sidebarCollapsed: false,
    planCollapsed: false,
    historyOpen: false,
    commentsOpen: false,
    triageOpen: false,
    docControlsCollapsed: false,
  },
  // Modèle PRÉ-SÉLECTIONNÉ par défaut (Fable) : le pré-remplissage manuel et le bouton
  // d'auto-pré-annotation sont immédiatement utilisables. L'auto-exécution reste OPT-IN
  // (`enabled: false` + modale de consentement) — on ne pré-annote jamais sans accord.
  prefill: { enabled: false, judge: DEFAULT_LLM_JUDGE, asked: false },
};

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
const asBool = (x: unknown, d: boolean): boolean => (typeof x === "boolean" ? x : d);
const asStr = (x: unknown, d: string): string => (typeof x === "string" ? x : d);

/** Map de booléens nettoyée (ignore les valeurs non booléennes). PUR. */
function cleanBoolMap(x: unknown): Record<string, boolean> {
  if (!isObj(x)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(x)) {
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

/**
 * Fusionne des préférences PARTIELLES sur des défauts, par section, en IGNORANT tout champ
 * inconnu (whitelist implicite) et en bornant les énumérations. Renvoie toujours un objet
 * complet et valide. PUR.
 */
export function mergeUiPrefs(
  defaults: UiPrefsV1,
  partial: unknown,
): UiPrefsV1 {
  const p = isObj(partial) ? partial : {};
  const o = isObj(p.overlays) ? p.overlays : {};
  const pan = isObj(p.panels) ? p.panels : {};
  const pf = isObj(p.prefill) ? p.prefill : {};

  const displayLangRaw = asStr((o as Record<string, unknown>).displayLang, defaults.overlays.displayLang);
  const displayLang = (DISPLAY_LANGS as string[]).includes(displayLangRaw)
    ? (displayLangRaw as DisplayLang)
    : defaults.overlays.displayLang;

  const judgeRaw = (pf as Record<string, unknown>).judge;
  const judge =
    typeof judgeRaw === "string" && judgeRaw.length > 0
      ? judgeRaw
      : judgeRaw === null
        ? null
        : defaults.prefill.judge;

  return {
    v: UI_PREFS_SCHEMA_VERSION,
    overlays: {
      showUnfairness: asBool((o as Record<string, unknown>).showUnfairness, defaults.overlays.showUnfairness),
      displayLang,
      llmSource: asStr((o as Record<string, unknown>).llmSource, defaults.overlays.llmSource),
    },
    ghostJudges: { ...defaults.ghostJudges, ...cleanBoolMap(p.ghostJudges) },
    panels: {
      inspectorOpen: asBool((pan as Record<string, unknown>).inspectorOpen, defaults.panels.inspectorOpen),
      sidebarCollapsed: asBool((pan as Record<string, unknown>).sidebarCollapsed, defaults.panels.sidebarCollapsed),
      planCollapsed: asBool((pan as Record<string, unknown>).planCollapsed, defaults.panels.planCollapsed),
      historyOpen: asBool((pan as Record<string, unknown>).historyOpen, defaults.panels.historyOpen),
      commentsOpen: asBool((pan as Record<string, unknown>).commentsOpen, defaults.panels.commentsOpen),
      triageOpen: asBool((pan as Record<string, unknown>).triageOpen, defaults.panels.triageOpen),
      docControlsCollapsed: asBool(
        (pan as Record<string, unknown>).docControlsCollapsed,
        defaults.panels.docControlsCollapsed,
      ),
    },
    prefill: {
      enabled: asBool((pf as Record<string, unknown>).enabled, defaults.prefill.enabled),
      judge,
      asked: asBool((pf as Record<string, unknown>).asked, defaults.prefill.asked),
    },
  };
}

/**
 * Normalise une valeur BRUTE (serveur ou cache local, version inconnue) en `UiPrefsV1` valide.
 * Migration douce par version croissante (ici v0/absent → v1 = simple fusion aux défauts ;
 * point d'extension pour les futures migrations de renommage). PUR.
 */
export function migratePrefs(raw: unknown): UiPrefsV1 {
  // Toute version <= courante est absorbée par la fusion aux défauts (clés inconnues ignorées,
  // clés absentes complétées). Les migrations de renommage v(n)→v(n+1) s'inséreront ici.
  return mergeUiPrefs(UI_PREFS_DEFAULTS, raw);
}
