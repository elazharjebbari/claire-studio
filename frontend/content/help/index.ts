/**
 * Réexport des contenus Markdown du centre d'aide en tant que chaînes brutes.
 *
 * Les fichiers `.md` du dossier restent la SOURCE DE VÉRITÉ (éditables à la main).
 * Ils sont importés via le suffixe `?raw` :
 *   - côté Vite/Vitest : support natif des imports `?raw` ;
 *   - côté Next 14 (webpack) : règle `asset/source` ajoutée dans `next.config.mjs`.
 *
 * Pour AJOUTER une section : créez `content/help/<slug>.md`, importez-le ici,
 * puis ajoutez la paire dans HELP_CONTENT et l'entrée correspondante dans
 * `manifest.ts`.
 */

import introduction from "./introduction.md?raw";
import demarrage from "./demarrage.md?raw";
import workspace from "./workspace.md?raw";
import selectionBlocs from "./selection-blocs.md?raw";
import modesLangue from "./modes-langue.md?raw";
import themesVocabulaire from "./themes-vocabulaire.md?raw";
import preannotationsLlm from "./preannotations-llm.md?raw";
import comparaisonLlm from "./comparaison-llm.md?raw";
import corpusPresentation from "./corpus-presentation.md?raw";
import annotationTypes from "./annotation-types.md?raw";
import categoriesClaudette from "./categories-claudette.md?raw";
import themesSegmentation from "./themes-segmentation.md?raw";
import guideAnnotation from "./guide-annotation.md?raw";
import injusticeClaudette from "./injustice-claudette.md?raw";
import certitude from "./certitude.md?raw";
import commentaires from "./commentaires.md?raw";
import versionsHistorique from "./versions-historique.md?raw";
import revue from "./revue.md?raw";
import exportContent from "./export.md?raw";
import traductions from "./traductions.md?raw";
import raccourcis from "./raccourcis.md?raw";
import faq from "./faq.md?raw";
import labExperiences from "./lab-experiences.md?raw";
import labMetriques from "./lab-metriques.md?raw";
import taxonomies from "./taxonomies.md?raw";

/** Map slug → contenu Markdown brut. */
export const HELP_CONTENT: Record<string, string> = {
  introduction,
  demarrage,
  workspace,
  "selection-blocs": selectionBlocs,
  "modes-langue": modesLangue,
  "themes-vocabulaire": themesVocabulaire,
  taxonomies,
  "preannotations-llm": preannotationsLlm,
  "comparaison-llm": comparaisonLlm,
  "corpus-presentation": corpusPresentation,
  "annotation-types": annotationTypes,
  "categories-claudette": categoriesClaudette,
  "themes-segmentation": themesSegmentation,
  "guide-annotation": guideAnnotation,
  "injustice-claudette": injusticeClaudette,
  certitude,
  commentaires,
  "versions-historique": versionsHistorique,
  revue,
  export: exportContent,
  traductions,
  raccourcis,
  faq,
  "lab-experiences": labExperiences,
  "lab-metriques": labMetriques,
};

/** Contenu Markdown d'une section, ou undefined si le slug est inconnu. */
export function helpContent(slug: string): string | undefined {
  return HELP_CONTENT[slug];
}
