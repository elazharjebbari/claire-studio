/**
 * Registre UNIFIÉ des raccourcis clavier de l'atelier (L9 — mode rafale clavier-first).
 * Source unique consommée par la cheat-sheet (ShortcutsHelp) ; les handlers vivent dans
 * useWorkspaceShortcuts / useDivergenceShortcuts. Garder les deux en phase.
 */

export interface ShortcutItem {
  /** Touches affichées (ex. ["⌘", "S"] ou ["j"]). */
  keys: string[];
  label: string;
}
export interface ShortcutGroup {
  title: string;
  items: ShortcutItem[];
}

export const WORKSPACE_SHORTCUTS: ShortcutGroup[] = [
  {
    title: "Navigation",
    items: [
      { keys: ["j"], label: "Phrase suivante" },
      { keys: ["k"], label: "Phrase précédente" },
      { keys: ["n"], label: "Divergence suivante (mode comparaison)" },
      { keys: ["p"], label: "Divergence précédente (mode comparaison)" },
    ],
  },
  {
    title: "Annoter",
    items: [
      { keys: ["b"], label: "Ouvrir la palette de thème" },
      { keys: ["t"], label: "Cibler le sélecteur de thème" },
      { keys: ["c"], label: "Commenter la clause sélectionnée" },
      { keys: ["0", "1", "2", "3"], label: "Certitude de la clause (hors comparaison)" },
    ],
  },
  {
    title: "Arbitrage (mode comparaison)",
    items: [
      { keys: ["1"], label: "Adopter Claude sur la divergence" },
      { keys: ["2"], label: "Adopter Codex sur la divergence" },
      { keys: ["e"], label: "Œil de frontière (preuves N-way)" },
      { keys: ["g"], label: "Panneau comparatif" },
      { keys: ["b"], label: "Basculer l'affichage des frontières" },
    ],
  },
  {
    title: "Session",
    items: [
      { keys: ["⌘", "S"], label: "Snapshot (instantané versionné)" },
      { keys: ["⌘", "Z"], label: "Annuler" },
      { keys: ["⌘", "Y"], label: "Rétablir" },
      { keys: ["?"], label: "Afficher cette aide" },
    ],
  },
];
