/**
 * Manifeste du centre d'aide CLAIRE Studio.
 *
 * Définit l'ORDRE et les TITRES des sections de documentation, regroupées par
 * thématique. Chaque entrée mappe un `slug` (= nom du fichier `.md` sans
 * extension) vers son titre lisible et son groupe de navigation.
 *
 * Pour AJOUTER une section :
 *   1. créer `content/help/<slug>.md` ;
 *   2. l'enregistrer dans `content/help/index.ts` (HELP_CONTENT) ;
 *   3. ajouter une entrée { slug, title, group } ci-dessous, au bon endroit.
 */

export interface HelpSection {
  slug: string;
  title: string;
  group: string;
}

/** Ordre canonique des sections (sert à la sidebar et au routage). */
export const HELP_MANIFEST: HelpSection[] = [
  { slug: "introduction", title: "Introduction", group: "Découverte" },
  { slug: "demarrage", title: "Démarrage", group: "Découverte" },
  { slug: "workspace", title: "Le workspace", group: "Annoter" },
  { slug: "selection-blocs", title: "Sélection multi-blocs", group: "Annoter" },
  { slug: "modes-langue", title: "Modes de langue & traduction", group: "Annoter" },
  { slug: "themes-vocabulaire", title: "Thèmes & vocabulaire", group: "Annoter" },
  { slug: "preannotations-llm", title: "Pré-annotations LLM", group: "Annoter" },
  { slug: "comparaison-llm", title: "Comparer & arbitrer (Claude/Codex)", group: "Annoter" },
  { slug: "injustice-claudette", title: "Injustice CLAUDETTE", group: "Annoter" },
  { slug: "certitude", title: "Certitude", group: "Annoter" },
  { slug: "commentaires", title: "Commentaires", group: "Collaborer" },
  { slug: "versions-historique", title: "Versions & historique", group: "Collaborer" },
  { slug: "revue", title: "Revue", group: "Collaborer" },
  { slug: "export", title: "Export", group: "Données" },
  { slug: "traductions", title: "Traductions", group: "Données" },
  { slug: "raccourcis", title: "Raccourcis clavier", group: "Référence" },
  { slug: "faq", title: "FAQ", group: "Référence" },
];

/** Ordre d'apparition des groupes dans la barre latérale. */
export const HELP_GROUP_ORDER: string[] = [
  "Découverte",
  "Annoter",
  "Collaborer",
  "Données",
  "Référence",
];

/** Liste ordonnée des groupes effectivement présents, avec leurs sections. */
export function helpGroups(): { group: string; sections: HelpSection[] }[] {
  return HELP_GROUP_ORDER.map((group) => ({
    group,
    sections: HELP_MANIFEST.filter((s) => s.group === group),
  })).filter((g) => g.sections.length > 0);
}

/** Retourne la section correspondant à un slug, ou undefined. */
export function helpSection(slug: string): HelpSection | undefined {
  return HELP_MANIFEST.find((s) => s.slug === slug);
}
