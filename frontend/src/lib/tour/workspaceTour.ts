/**
 * Visite guidée du workspace d'annotation (driver.js, MIT).
 *
 * Les étapes ciblent des sélecteurs RÉELS existants (data-testid + rôles ARIA),
 * regroupées en 6 sections pédagogiques (champ `section`, préfixé au titre).
 * Au lancement, on filtre dynamiquement les étapes dont l'élément cible est
 * absent du DOM (ex. l'inspecteur, les commentaires ou l'œil de frontière
 * n'existent qu'avec une clause/frontière sélectionnée), pour que la visite
 * reste cohérente quel que soit l'état.
 *
 * Vocabulaire N-way : l'atelier compare l'annotation humaine à PLUSIEURS juges
 * LLM (Claude, Codex, Mistral…), pas seulement deux.
 */

import { driver, type Config, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

/** Étape de visite : section + sélecteur CSS obligatoire + popover (titre + description). */
export interface TourStep {
  section: string;
  element: string;
  title: string;
  description: string;
}

/** Définition ordonnée des étapes de la visite guidée du workspace. */
export const WORKSPACE_TOUR_STEPS: TourStep[] = [
  // ── A. Vue d'ensemble ───────────────────────────────────────────────────
  {
    section: "Vue d'ensemble",
    element: '[data-testid="annotation-workspace"]',
    title: "L'atelier d'annotation",
    description:
      "Trois panneaux : le plan (gauche), le document (centre), l'inspecteur (droite). On découpe le document en clauses, on leur attribue un thème, et on compare son travail à celui des juges LLM.",
  },
  {
    section: "Vue d'ensemble",
    element: '[aria-label="Plan du document"]',
    title: "Le plan",
    description:
      "Liste les clauses du document (thèmes colorés), la progression et les bascules d'overlays. Cliquez une clause pour y sauter.",
  },

  // ── B. Lire le document ─────────────────────────────────────────────────
  {
    section: "Lire",
    element: '[aria-label="Document"]',
    title: "Le document",
    description:
      "Le texte en lecture. Cliquez une phrase, ou appuyez sur la touche B pour poser une frontière de clause sur la phrase focalisée.",
  },
  {
    section: "Lire",
    element: '[data-testid="sentence-0"]',
    title: "Une phrase",
    description:
      "Chaque phrase est indexée et cliquable. Au clavier : j (suivante), k (précédente).",
  },
  {
    section: "Lire",
    element: '[data-testid="reading-controls"]',
    title: "Confort de lecture",
    description:
      "Ajustez la taille du texte (A− / A+) et la largeur de lecture. N'affecte que l'affichage — vos données ne changent pas.",
  },
  {
    section: "Lire",
    element: '[data-testid="lang-switch"]',
    title: "Modes de langue",
    description:
      "Basculez VO (original) · Bilingue (VO + FR) · FR (traduction). Toutes les interactions opèrent sur l'index de phrase, quel que soit le mode.",
  },

  // ── C. Annoter ──────────────────────────────────────────────────────────
  {
    section: "Annoter",
    element: '[data-testid="boundary-toggle"]',
    title: "Frontières de clause",
    description:
      "Affichez ou masquez les frontières (rail coloré + pointillés). Repère visuel discret, indépendant de l'overlay d'injustice.",
  },
  {
    section: "Annoter",
    element: '[data-testid="selection-tools"]',
    title: "Outils de sélection",
    description:
      "Sélectionnez plusieurs blocs (segment, jusqu'à la frontière, tout), puis annotez, désannotez ou traduisez la sélection en une fois. Le compteur indique le nombre de blocs sélectionnés.",
  },
  {
    section: "Annoter",
    element: '[data-testid="theme-palette"]',
    title: "Attribuer un thème",
    description:
      "Choisissez un thème dans la palette (vocabulaire fermé). Raccourci : touche T pour cibler la recherche de thème.",
  },
  {
    section: "Annoter",
    element: '[data-testid="legal-nature"]',
    title: "Nature juridique",
    description:
      "Renseignez la nature juridique de la clause (obligation, droit, définition, sanction…), consultable et comparable aux propositions des juges LLM.",
  },
  {
    section: "Annoter",
    element: '[data-testid="certainty-picker"]',
    title: "La certitude",
    description:
      "Notez votre confiance sur l'échelle 0–3. Au clavier : touches 0, 1, 2 ou 3 sur la clause sélectionnée.",
  },
  {
    section: "Annoter",
    element: '[data-testid="inspector"]',
    title: "L'inspecteur",
    description:
      "Détaille la clause sélectionnée : thème, nature juridique, certitude, evidence span, justification (rationale) et commentaires.",
  },
  {
    section: "Annoter",
    element: '[data-testid="validation-meter"]',
    title: "Validation & progression",
    description:
      "La jauge indique la part de clauses validées de votre session. Validez une clause pour la marquer comme finalisée.",
  },

  // ── D. Comparer aux juges LLM (N-way) ───────────────────────────────────
  {
    section: "Comparer aux juges",
    element: '[data-testid="llm-version-select"]',
    title: "Version des annotations LLM",
    description:
      "Choisissez la version comparée (v9, v9.1, v9.2…). Instantané, et n'affecte QUE l'overlay LLM : vos clauses humaines ne bougent pas. « Auto » prend la version la plus riche.",
  },
  {
    section: "Comparer aux juges",
    element: '[data-testid="llm-source-switch"]',
    title: "Source affichée",
    description:
      "Affichez votre annotation, celle d'un juge (Claude, Codex, Mistral…), ou le mode Comparaison qui superpose l'accord par phrase (vert = accord, ambre = divergence) et active la navigation des désaccords.",
  },
  {
    section: "Comparer aux juges",
    element: '[data-testid="prefill-switch"]',
    title: "Pré-remplir depuis un juge",
    description:
      "Chargez les frontières et thèmes proposés par un juge comme brouillon éditable, et basculez d'un juge à l'autre : vos clauses humaines sont préservées. « Aucun » retire le pré-remplissage.",
  },
  {
    section: "Comparer aux juges",
    element: '[data-testid^="boundary-peek-"]',
    title: "Œil de frontière (touche e)",
    description:
      "Sur une frontière de clause, l'icône 👁 ouvre les preuves (evidence span) et le raisonnement (rationale) de chaque juge — onglets dynamiques pour les comparer. Vous pouvez adopter une proposition directement depuis l'aperçu.",
  },
  {
    section: "Comparer aux juges",
    element: '[data-testid="inspector-source-compare"]',
    title: "Comparer la source (par clause)",
    description:
      "Sous l'evidence span et le rationale, comparez votre annotation à celle de chaque juge pour la clause sélectionnée, et reprenez une proposition en un clic.",
  },
  {
    section: "Comparer aux juges",
    element: '[data-testid="toggle-compare-panel"]',
    title: "Panneau comparatif (touche g)",
    description:
      "Vue côte à côte des découpages des juges : couleurs = thèmes, bande centrale = accord (vert) / divergence (ambre) / partiel. Cliquez un bloc pour y sauter.",
  },
  {
    section: "Comparer aux juges",
    element: '[data-testid="divergence-nav"]',
    title: "Naviguer les divergences (n/p)",
    description:
      "En mode comparaison, sautez de désaccord en désaccord avec les flèches ou les touches n (suivant) / p (précédent). Adoptez une proposition avec 1 (Claude) / 2 (Codex), ou via l'œil 👁 pour n'importe quel juge (dont Mistral). Le compteur indique votre position.",
  },

  // ── E. Overlays ─────────────────────────────────────────────────────────
  {
    section: "Overlays",
    element: '[data-testid="toc-overlays-summary"]',
    title: "Affichage — overlays (replié par défaut)",
    description:
      "Dépliez « Affichage » au pied du plan pour activer les overlays : injustice CLAUDETTE (zones sensibles), fantômes LLM en pointillés (frontières proposées par un juge, comparaison seulement) et traduction (FR). Un badge « N actifs » indique ce qui est allumé sous le pli.",
  },
  {
    section: "Overlays",
    element: '[data-testid="gutter-toggle-category"]',
    title: "Gouttière des catégories",
    description:
      "Affichez à gauche du document une bande continue par catégorie de thème, avec les ruptures entre clauses voisines, pour lire la structure d'un coup d'œil.",
  },

  // ── F. Collaborer & versionner ──────────────────────────────────────────
  {
    section: "Collaborer & versionner",
    element: '[data-testid="toggle-comments"]',
    title: "Commentaires (touche c)",
    description:
      "Justifiez un choix ou dialoguez avec les relecteurs sur une clause. Raccourci : touche C sur la clause sélectionnée.",
  },
  {
    section: "Collaborer & versionner",
    element: '[data-testid="toggle-history"]',
    title: "Historique · annuler / rétablir",
    description:
      "Ouvrez le journal de vos actions (création, thème, certitude, arbitrage…) ; cliquez une entrée pour revenir sur la phrase concernée. Annulez/rétablissez avec ⌘Z / ⌘Y (boutons dédiés dans la barre).",
  },
  {
    section: "Collaborer & versionner",
    element: '[data-testid="document-switcher"]',
    title: "Changer de document",
    description:
      "Recherchez un document (autocomplétion) et passez d'un contrat à l'autre. Un voyant « ● brouillon » signale des modifications non enregistrées.",
  },
  {
    section: "Collaborer & versionner",
    element: '[data-testid="snapshot-btn"]',
    title: "Snapshot",
    description:
      "Capturez un instantané versionné de votre annotation. Raccourci : ⌘S, même en cours de saisie.",
  },
  {
    section: "Collaborer & versionner",
    element: '[data-testid="submit-btn"]',
    title: "Soumettre",
    description: "Une fois prêt, soumettez l'annotation pour relecture.",
  },

  // ── Fin ─────────────────────────────────────────────────────────────────
  {
    section: "Fin",
    element: '[data-testid="annotation-workspace"]',
    title: "C'est tout !",
    description:
      "Raccourcis clés : j/k phrase · n/p divergence · 1/2 adopter Claude/Codex (en comparaison) · e œil de frontière · g panneau comparatif · b frontière · t thème · c commentaire · 0–3 certitude · ⌘S snapshot · ⌘Z/⌘Y annuler/rétablir. Le détail complet est dans le centre d'aide (« Documentation » dans la barre du haut).",
  },
];

/** Vrai si l'élément ciblé par l'étape est présent dans le DOM. */
function stepElementExists(step: TourStep): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector(step.element) !== null;
}

/** Convertit une TourStep en DriveStep driver.js (titre préfixé par la section). */
function toDriveStep(step: TourStep): DriveStep {
  const title =
    step.section && step.section !== "Fin"
      ? `${step.section} · ${step.title}`
      : step.title;
  return {
    element: step.element,
    popover: { title, description: step.description },
  };
}

/** Configuration de base de driver.js (boutons FR, progression, défilement doux). */
export function tourConfig(steps: TourStep[]): Config {
  return {
    showProgress: true,
    allowKeyboardControl: true,
    smoothScroll: true,
    stagePadding: 6,
    progressText: "{{current}} / {{total}}",
    nextBtnText: "Suivant",
    prevBtnText: "Précédent",
    doneBtnText: "Terminer",
    steps: steps.map(toDriveStep),
  };
}

/**
 * Lance la visite guidée du workspace. Filtre les étapes dont la cible est
 * absente du DOM, puis démarre driver.js. No-op si aucune étape n'est exploitable.
 */
export function startWorkspaceTour(): void {
  const steps = WORKSPACE_TOUR_STEPS.filter(stepElementExists);
  if (steps.length === 0) return;
  const instance = driver(tourConfig(steps));
  instance.drive();
}
