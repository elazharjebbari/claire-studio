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
    element: '[data-testid="prefill-claude"]',
    title: "Pré-remplir depuis un LLM",
    description:
      "Chargez les ancres et thèmes proposés par Claude (ou Codex) comme brouillon éditable. La provenance reste tracée.",
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
      "Raccourcis clés : j/k navigation, B frontière, T thème, C commentaire, 0–3 certitude, ⌘S snapshot, ⌘K palette. Retrouvez le détail dans le centre d'aide (lien « ? » dans la barre du haut).",
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
