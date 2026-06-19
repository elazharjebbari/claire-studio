/**
 * Visite guidée du workspace d'annotation (driver.js, MIT).
 *
 * Les étapes ciblent des sélecteurs RÉELS existants (data-testid + rôles ARIA).
 * Au lancement, on filtre dynamiquement les étapes dont l'élément cible est
 * absent du DOM (ex. le fil de commentaires n'existe que si une clause est
 * sélectionnée), pour que la visite reste cohérente quel que soit l'état.
 */

import { driver, type Config, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

/** Étape de visite : sélecteur CSS obligatoire + popover (titre + description). */
export interface TourStep {
  element: string;
  title: string;
  description: string;
}

/** Définition ordonnée des étapes de la visite guidée du workspace. */
export const WORKSPACE_TOUR_STEPS: TourStep[] = [
  {
    element: '[data-testid="annotation-workspace"]',
    title: "L'atelier d'annotation",
    description:
      "Voici l'atelier d'annotation. Trois panneaux pour découper le document en clauses, leur attribuer un thème, et comparer votre travail aux LLM.",
  },
  {
    element: '[aria-label="Plan du document"]',
    title: "Le plan",
    description:
      "Le plan liste les clauses du document (thèmes colorés), la progression et les bascules d'overlays. Cliquez une clause pour y sauter.",
  },
  {
    element: '[aria-label="Document"]',
    title: "Le document",
    description:
      "Le document en lecture. Cliquez une phrase ou appuyez sur la touche B pour poser une frontière de clause sur la phrase focalisée.",
  },
  {
    element: '[data-testid="sentence-0"]',
    title: "Une phrase",
    description:
      "Chaque phrase est indexée et cliquable. Naviguez au clavier avec j (suivant) et k (précédent).",
  },
  {
    element: '[data-testid="boundary-toggle"]',
    title: "Frontières",
    description:
      "Activez ou masquez les frontières de clause (rail coloré + pointillés). Un repère visuel discret, indépendant du surlignage d'injustice.",
  },
  {
    element: '[data-testid="lang-switch"]',
    title: "Modes de langue",
    description:
      "Basculez l'affichage entre VO (original), Bilingue (VO + FR) et FR (traduction). Toutes les interactions opèrent sur l'index de phrase, quel que soit le mode.",
  },
  {
    element: '[data-testid="llm-version-select"]',
    title: "Version des annotations LLM",
    description:
      "Choisissez la version d'annotation LLM à comparer (v9, v9.1, v9.2, v9.3…). Le changement est instantané et n'affecte QUE l'overlay LLM : vos clauses humaines ne bougent pas. « Auto » sélectionne la version la plus riche.",
  },
  {
    element: '[data-testid="llm-source-switch"]',
    title: "Source affichée : humain, Claude, Codex, comparaison",
    description:
      "Affichez votre annotation, celle d'un juge, ou le mode Comparaison qui superpose l'accord par phrase (vert = accord, ambre = divergence) et active la navigation des désaccords.",
  },
  {
    element: '[data-testid="divergence-nav"]',
    title: "Naviguer les divergences",
    description:
      "En mode comparaison, sautez de désaccord en désaccord avec les flèches ou les touches n (suivant) / p (précédent). Le compteur indique votre position.",
  },
  {
    element: '[data-testid="toggle-compare-panel"]',
    title: "Panneau comparatif (touche g)",
    description:
      "Ouvrez la vue côte à côte des blocs de Claude et de Codex : couleurs = thèmes, bande centrale = accord (vert) / divergence (ambre) / partiel. Cliquez un bloc pour y sauter.",
  },
  {
    element: '[data-testid="sentence-0"]',
    title: "Sélection multi-blocs",
    description:
      "Maintenez le clic-droit et glissez sur plusieurs phrases pour sélectionner une plage de blocs (clauses), puis annotez-les ensemble. Un clic-droit immobile ouvre le menu de la phrase.",
  },
  {
    element: '[data-testid^="boundary-peek-"]',
    title: "Aperçu des preuves à la frontière (touche e)",
    description:
      "Sur une frontière de clause, l'icône 👁 ouvre un aperçu compact des preuves (evidence span) et du raisonnement (rationale) de Claude et de Codex — onglet « Comparer » pour les voir en regard. Vous pouvez adopter une proposition directement depuis cet aperçu.",
  },
  {
    element: '[data-testid="inspector"]',
    title: "L'inspecteur",
    description:
      "L'inspecteur détaille la clause sélectionnée : thème, nature juridique, certitude, evidence span, justification et commentaires.",
  },
  {
    element: '[data-testid="theme-palette"]',
    title: "Attribuer un thème",
    description:
      "Choisissez un thème dans la palette (vocabulaire fermé). Raccourci : touche T pour cibler la recherche de thème.",
  },
  {
    element: '[data-testid="certainty-picker"]',
    title: "La certitude",
    description:
      "Notez votre confiance sur l'échelle 0–3. Au clavier : touches 0, 1, 2 ou 3 sur la clause sélectionnée.",
  },
  {
    element: '[data-testid="document-switcher"]',
    title: "Changer de document",
    description:
      "Recherchez un document (autocomplétion) et naviguez d'un contrat à l'autre. Un voyant « ● brouillon » signale les modifications non enregistrées.",
  },
  {
    element: '[data-testid="prefill-switch"]',
    title: "Pré-remplir depuis un LLM (commutable)",
    description:
      "Chargez les ancres et thèmes proposés par Claude ou Codex comme brouillon éditable, et basculez entre les deux : vos clauses humaines sont préservées. « Aucun » retire le pré-remplissage.",
  },
  {
    element: '[data-testid="toggle-history"]',
    title: "Historique des actions",
    description:
      "Ouvrez le journal de vos actions (création, thème, certitude, arbitrage…). Cliquez une entrée pour revenir sur la phrase concernée. Socle de l'annulation/rétablissement à venir.",
  },
  {
    element: '[data-testid="toggle-unfairness"]',
    title: "Overlay d'injustice CLAUDETTE",
    description:
      "Surlignez les phrases marquées injustes par CLAUDETTE, avec leur catégorie et leur niveau, pour repérer les zones sensibles.",
  },
  {
    element: '[data-testid="toggle-ghost-claude"]',
    title: "Fantômes de comparaison",
    description:
      "Affichez en pointillés les frontières proposées par un LLM mais non encore retenues. Comparaison seulement : votre annotation n'est pas modifiée.",
  },
  {
    element: '[data-testid="comment-thread"]',
    title: "Commentaires",
    description:
      "Justifiez un choix ou dialoguez avec les relecteurs. Raccourci : touche C sur la clause sélectionnée.",
  },
  {
    element: '[data-testid="snapshot-btn"]',
    title: "Snapshot",
    description:
      "Capturez un instantané de votre annotation (versionné). Raccourci : ⌘S, même en cours de saisie.",
  },
  {
    element: '[data-testid="submit-btn"]',
    title: "Soumettre",
    description:
      "Une fois prêt, soumettez l'annotation pour relecture.",
  },
  {
    element: '[data-testid="annotation-workspace"]',
    title: "C'est tout !",
    description:
      "Raccourcis clés : j/k phrase · n/p divergence · 1/2 adopter Claude/Codex · e aperçu frontière · g panneau comparatif · B frontière · T thème · C commentaire · 0–3 certitude · ⌘S snapshot · ⌘K palette. Le détail est dans le centre d'aide (« ? » dans la barre du haut).",
  },
];

/** Vrai si l'élément ciblé par l'étape est présent dans le DOM. */
function stepElementExists(step: TourStep): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector(step.element) !== null;
}

/** Convertit une TourStep en DriveStep driver.js. */
function toDriveStep(step: TourStep): DriveStep {
  return {
    element: step.element,
    popover: { title: step.title, description: step.description },
  };
}

/** Configuration de base de driver.js (boutons FR, progression, clavier actif). */
export function tourConfig(steps: TourStep[]): Config {
  return {
    showProgress: true,
    allowKeyboardControl: true,
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
