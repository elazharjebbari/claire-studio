import { test, expect, type Page } from "@playwright/test";

/**
 * Points 0, 1, 2 : pré-remplissage commutable, navigation documents (voyant draft +
 * recherche), en-tête sticky, soumission versionnée, historique d'actions.
 */

async function open(page: Page) {
  await page.goto("/annotate/ann-1");
  await expect(page.getByTestId("annotation-workspace")).toBeVisible();
}

test.describe("Collaboration & versioning — socle (points 0,1,2)", () => {
  test("le pré-remplissage bascule réellement entre Claude et Codex (point 0a)", async ({
    page,
  }) => {
    await open(page);
    const claude = page.getByTestId("prefill-claude");
    const codex = page.getByTestId("prefill-codex");
    await claude.click();
    await expect(claude).toHaveAttribute("aria-checked", "true");
    await codex.click();
    await expect(codex).toHaveAttribute("aria-checked", "true");
    await expect(claude).toHaveAttribute("aria-checked", "false");
    // Retour à "Aucun" possible.
    await page.getByTestId("prefill-none").click();
    await expect(page.getByTestId("prefill-none")).toHaveAttribute("aria-checked", "true");
  });

  test("la barre de documents cherche, affiche le voyant draft et navigue (point 0b)", async ({
    page,
  }) => {
    await open(page);
    // Crée une modif → dirty → voyant draft.
    await page.getByTestId("sentence-9").click();
    await page.getByTestId("inspector").getByTestId("theme-option-TERMINATION").click();
    await expect(page.getByTestId("draft-indicator")).toBeVisible();
    // Ouvre la barre + recherche.
    await page.getByTestId("document-switcher-button").click();
    await expect(page.getByTestId("document-search")).toBeVisible();
    await page.getByTestId("document-search").fill("fit");
    // Au moins une option (le document courant Fitbit) reste visible.
    await expect(page.getByTestId("document-option-doc-fitbit")).toBeVisible();
  });

  test("l'en-tête de contrôles reste sticky au scroll (point 1)", async ({ page }) => {
    await open(page);
    await expect(page.getByTestId("document-controls")).toBeVisible();
    await page.getByTestId("sentence-30").scrollIntoViewIfNeeded();
    // Toujours visible après défilement.
    await expect(page.getByTestId("document-controls")).toBeInViewport();
  });

  test("la soumission est versionnée : nom requis + description (point 2)", async ({ page }) => {
    await open(page);
    await page.getByTestId("submit-btn").click();
    const dialog = page.getByTestId("submit-dialog");
    await expect(dialog).toBeVisible();
    // Confirmer désactivé tant que le nom est vide.
    await expect(page.getByTestId("submit-confirm")).toBeDisabled();
    await page.getByTestId("version-name").fill("v1 — relecture résiliation");
    await page.getByTestId("version-description").fill("Clauses de résiliation revues.");
    await expect(page.getByTestId("submit-confirm")).toBeEnabled();
    await page.getByTestId("submit-confirm").click();
    await expect(dialog).toBeHidden();
  });

  test("l'historique journalise les actions et recentre au clic (point 2)", async ({ page }) => {
    await open(page);
    // Une action humaine.
    await page.getByTestId("sentence-9").click();
    await page.getByTestId("inspector").getByTestId("theme-option-TERMINATION").click();
    await page.getByTestId("toggle-history").click();
    const panel = page.getByTestId("history-panel");
    await expect(panel).toBeVisible();
    // Au moins une entrée de création de clause.
    const entry = panel.getByText(/Clause .* créée @9/);
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(page.getByTestId("sentence-9")).toHaveAttribute("data-focused", "true");
  });

  test("annuler / rétablir une création de clause (point 4a)", async ({ page }) => {
    await open(page);
    await page.getByTestId("sentence-9").click();
    await page.getByTestId("inspector").getByTestId("theme-option-TERMINATION").click();
    const planChip = page
      .getByRole("complementary", { name: "Plan du document" })
      .getByTestId("clause-chip")
      .filter({ hasText: "[9]" });
    await expect(planChip).toBeVisible();

    await page.getByTestId("toggle-history").click();
    await page.getByTestId("undo-btn").click();
    await expect(planChip).toHaveCount(0); // clause annulée
    await page.getByTestId("redo-btn").click();
    await expect(planChip).toBeVisible(); // clause rétablie
  });
});
