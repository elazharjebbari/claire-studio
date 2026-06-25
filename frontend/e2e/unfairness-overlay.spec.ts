import { test, expect } from "@playwright/test";

/**
 * F12 — Overlay d'injustice CLAUDETTE : surlignage natif togglable + loupe d'injustice
 * (aperçu au survol, fiche complète au clic). Voir docs/pactiva/dossier-injustice-hover.
 */

test.describe("Overlay injustice CLAUDETTE (F12)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();
    // Les overlays sont désormais repliés par défaut (révélation à la demande) : on déplie
    // « Affichage » pour rendre les toggles actionnables.
    await page.getByTestId("toc-overlays-summary").click();
  });

  test("affiche le surlignage par défaut et le retire au toggle", async ({ page }) => {
    // Phrase 22 = arbitrage (catégorie A, niveau 3).
    await expect(page.getByTestId("unfairness-22")).toBeVisible();

    await page.getByTestId("toggle-unfairness").uncheck();
    await expect(page.getByTestId("unfairness-22")).toHaveCount(0);

    await page.getByTestId("toggle-unfairness").check();
    await expect(page.getByTestId("unfairness-22")).toBeVisible();
  });

  test("la marque expose la catégorie et le niveau (a11y)", async ({ page }) => {
    await expect(page.getByTestId("unfairness-20")).toHaveAttribute(
      "aria-label",
      /Limitation de responsabilité/,
    );
  });

  test("survol de la marque → carte riche (catégorie + évidence)", async ({ page }) => {
    await page.getByTestId("unfairness-22").hover();
    const preview = page.getByTestId("injustice-lens-preview");
    await expect(preview).toBeVisible();
    await expect(preview).toContainText(/injuste/i);
    await expect(preview).toContainText(/Arbitrage/);
    await expect(preview).toContainText(/Évidence/);
  });

  test("phrase multi-catégories → plusieurs cartes (phrase 20 = LTD + A)", async ({ page }) => {
    await page.getByTestId("unfairness-20").hover();
    const preview = page.getByTestId("injustice-lens-preview");
    await expect(preview).toBeVisible();
    await expect(preview.getByTestId("injustice-card-LTD")).toBeVisible();
    await expect(preview.getByTestId("injustice-card-A")).toBeVisible();
  });

  test("clavier : focus + Entrée sur la marque → fiche épinglée, Échap ferme", async ({ page }) => {
    const mark = page.getByTestId("unfairness-22");
    await mark.focus();
    await page.keyboard.press("Enter");
    const card = page.getByTestId("injustice-lens-pinned");
    await expect(card).toBeVisible();
    await expect(card).toContainText(/Arbitrage/);
    await page.keyboard.press("Escape");
    await expect(card).toHaveCount(0);
  });

  test("clic sur une phrase marquée → sélection préservée (pas de détournement)", async ({ page }) => {
    // Le clic sur la marque ne doit PAS être capturé : il focalise la phrase.
    await page.getByTestId("unfairness-22").click();
    await expect(page.getByTestId("sentence-22")).toHaveAttribute("data-focused", "true");
    await expect(page.getByTestId("injustice-lens-pinned")).toHaveCount(0);
  });

  test("overlay désactivé → plus de marque ni de loupe", async ({ page }) => {
    await page.getByTestId("toggle-unfairness").uncheck();
    await expect(page.getByTestId("unfairness-22")).toHaveCount(0);
  });
});
