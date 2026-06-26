import { test, expect } from "@playwright/test";

/**
 * Refonte ergonomique du DocumentPanel (document-panel-redesign.md) — mode mock.
 * Couvre : frontières togglables, menu phrase (clic-droit) + accord LLM,
 * multi-sélection (Shift+clic), traduction du document.
 *
 * Le clic SIMPLE reste inchangé (couvert par annotate.spec.ts) : ces specs n'ajoutent
 * que les nouvelles interactions.
 */

test.describe("DocumentPanel — refonte ergonomique", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();
  });

  test("rail de thème : CONTINU sur même thème, RUPTURE au changement, provenance humain vs LLM", async ({ page }) => {
    // Crée un BLOC humain continu : phrases 5 et 6 (libres) avec le MÊME thème.
    for (const i of [5, 6]) {
      await page.getByTestId(`sentence-${i}`).click({ button: "right" });
      await page.getByTestId("sentence-menu").getByTestId("theme-option-TERMINATION").click();
      await page.keyboard.press("Escape");
    }
    // CONTINUITÉ : rail présent sur les deux ; la frontière (data-boundary) n'apparaît QUE sur
    // la 1re phrase du bloc (5), PAS sur la 2e (6) de même thème → plus de « pointillés partout ».
    await expect(page.getByTestId("rail-5")).toBeVisible();
    await expect(page.getByTestId("sentence-5")).toHaveAttribute("data-boundary", "true");
    await expect(page.getByTestId("sentence-6")).not.toHaveAttribute("data-boundary", "true");
    // PROVENANCE : bloc créé/annoté par l'humain → ferme.
    await expect(page.getByTestId("sentence-5")).toHaveAttribute("data-provenance", "firm");
    // En mode JUGE (segmentation suggérée) → le rail passe en provenance « suggested ».
    await page.getByTestId("llm-claude").click();
    await expect(page.getByTestId("sentence-0")).toHaveAttribute("data-provenance", "suggested");
  });

  test("réglette de frontières par modèle OPT-IN : masquée par défaut, affichée au clic (L7)", async ({ page }) => {
    // Flux de lecture propre par défaut : aucune cellule de gouttière par modèle.
    await expect(page.locator('[data-testid^="gutter-cell-claude-"]')).toHaveCount(0);
    await expect(page.getByTestId("gutter-toggle-claude")).toHaveAttribute("aria-pressed", "false");
    // Activer Claude via la légende → la piste apparaît (densité À LA DEMANDE).
    await page.getByTestId("gutter-toggle-claude").click();
    await expect(page.getByTestId("gutter-toggle-claude")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-testid^="gutter-cell-claude-"]').first()).toBeVisible();
  });

  test("la barre d'outils du document se replie pour gagner de la place (petits écrans)", async ({ page }) => {
    // Déployée par défaut : les contrôles sont visibles.
    await expect(page.getByTestId("reading-controls")).toBeVisible();
    await expect(page.getByTestId("llm-source-switch")).toBeVisible();
    await expect(page.getByTestId("collab-bar")).toBeVisible();
    // Fermer → la barre se FERME entièrement (contrôles ET CollabBar) ; seul le bouton reste.
    await page.getByTestId("doc-controls-toggle").click();
    await expect(page.getByTestId("reading-controls")).toHaveCount(0);
    await expect(page.getByTestId("llm-source-switch")).toHaveCount(0);
    await expect(page.getByTestId("collab-bar")).toHaveCount(0);
    await expect(page.getByTestId("doc-controls-toggle")).toBeVisible();
    // Rouvrir → tout revient.
    await page.getByTestId("doc-controls-toggle").click();
    await expect(page.getByTestId("reading-controls")).toBeVisible();
    await expect(page.getByTestId("collab-bar")).toBeVisible();
  });

  test("la touche ? ouvre la cheat-sheet des raccourcis, Échap ferme (L9)", async ({ page }) => {
    await page.keyboard.press("?");
    const help = page.getByTestId("shortcuts-help");
    await expect(help).toBeVisible();
    await expect(help).toContainText("Raccourcis");
    await page.keyboard.press("Escape");
    await expect(help).toHaveCount(0);
  });

  test("l'overlay frontières est togglable (pointillés au début de run)", async ({ page }) => {
    // Le 1er début de clause humaine porte data-boundary + data-dashed quand ON.
    const firstBoundary = page.locator('[data-boundary="true"]').first();
    await expect(firstBoundary).toHaveAttribute("data-dashed", "true");

    await page.getByTestId("boundary-toggle").uncheck();
    await expect(page.locator('[data-dashed="true"]')).toHaveCount(0);

    await page.getByTestId("boundary-toggle").check();
    await expect(page.locator('[data-dashed="true"]').first()).toBeVisible();
  });

  test("le clic-droit ouvre le menu de phrase (geste rapide, sans bloc LLM)", async ({ page }) => {
    await page.getByTestId("sentence-2").click({ button: "right" });
    await expect(page.getByTestId("sentence-menu")).toBeVisible();
    // Le menu est désormais un geste rapide : plus de bloc « Propositions LLM »
    // (disponible au survol, via l'œil de frontière et dans l'inspecteur).
    await expect(page.getByTestId("menu-llm")).toHaveCount(0);
    await expect(page.getByTestId("menu-translate")).toBeVisible();
    // Fermeture à Échap.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("sentence-menu")).toHaveCount(0);
  });

  test("Shift+clic crée une multi-sélection et affiche la barre d'actions", async ({ page }) => {
    await page.getByTestId("sentence-2").click();
    await page.getByTestId("sentence-4").click({ modifiers: ["Shift"] });
    const toolbar = page.getByTestId("selection-toolbar");
    await expect(toolbar).toBeVisible();
    // `selection-count` existe aussi dans selection-tools → scoper à la barre visée.
    await expect(toolbar.getByTestId("selection-count")).toContainText("3");
  });

  test("le mode Bilingue affiche la ligne FR sous l'original", async ({ page }) => {
    await page.getByTestId("lang-both").click();
    await expect(page.getByTestId("translation-0")).toBeVisible();
  });

  test("le mode FR affiche le texte traduit dans la phrase", async ({ page }) => {
    await page.getByTestId("lang-fr").click();
    // sentence-0 a une traduction mock → son texte devient le FR.
    await expect(page.getByTestId("sentence-0")).toContainText("[FR] Phrase 0 traduite.");
  });
});
