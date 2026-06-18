/**
 * Déclaration de type pour les imports Markdown bruts.
 *
 * Permet `import contenu from "./fichier.md?raw"` (chaîne brute) côté TS, Vite
 * (vitest) et Next 14 (via la règle webpack `asset/source` de `next.config.mjs`).
 */
declare module "*.md?raw" {
  const content: string;
  export default content;
}

declare module "*.md" {
  const content: string;
  export default content;
}
