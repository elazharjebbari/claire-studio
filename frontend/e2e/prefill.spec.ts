import { test, expect } from "@playwright/test";

/**
 * F2 — Pré-remplissage depuis les pré-annotations LLM (claude/codex), provenance
 * tracée, fantômes pour comparaison.
 */

test.describe("Pré-remplissage LLM (F2)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();
  });

  test("charge les clauses Claude comme brouillon avec provenance", async ({ page }) => {
    const before = await page.getByTestId("clause-chip").count();
    await page.getByTestId("prefill-claude").click();
    const after = await page.getByTestId("clause-chip").count();
    expect(after).toBeGreaterThan(before);

    // Sélectionner une clause seedée et vérifier la provenance.
    await page.getByTestId("clause-chip").filter({ hasText: "[16]" }).first().click();
    await expect(page.getByTestId("provenance")).toContainText("preannotation:claude");
  });

  test("affiche les fantômes Claude quand l'overlay est activé", async ({ page }) => {
    // Les fantômes sont chargés au montage (overlay de comparaison) : on active simplement
    // l'overlay, sans pré-remplir (le pré-remplissage transformerait les fantômes en ancres).
    await page.getByTestId("toggle-ghost-claude").check();
    // Le fantôme Claude est rendu par phrase via son testid (même pattern stable que
    // collab-versioning) ; le libellé visible « claude:THEME » n'est pas un sélecteur fiable.
    await expect(page.getByTestId("ghost-claude-0")).toBeVisible();
  });
});
