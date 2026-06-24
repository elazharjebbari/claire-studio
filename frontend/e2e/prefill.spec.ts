import { test, expect } from "@playwright/test";

/**
 * F2 — Pré-remplissage depuis les pré-annotations LLM (claude/codex), provenance
 * tracée, fantômes pour comparaison. + Auto-pré-annotation PAR COMPTE (consentement /
 * switch / popover Préférences).
 */

test.describe("Pré-remplissage LLM (F2)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();
  });

  /** ann-1 contient déjà des clauses → confirmation d'écrasement, puis (1ère fois)
   *  consentement auto-prefill. Helper tolérant à l'état `asked` (state MSW persistant). */
  async function applyPrefill(page: import("@playwright/test").Page, judge: string) {
    await page.getByTestId(`prefill-${judge}`).click();
    const confirm = page.getByTestId("prefill-confirm-ok");
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
  }

  test("charge les clauses Claude comme brouillon avec provenance", async ({ page }) => {
    const before = await page.getByTestId("clause-chip").count();
    await applyPrefill(page, "claude");
    // 1ère exécution → modale de consentement auto-prefill : on refuse pour continuer.
    const decline = page.getByTestId("auto-prefill-decline");
    if (await decline.isVisible().catch(() => false)) await decline.click();
    const after = await page.getByTestId("clause-chip").count();
    expect(after).toBeGreaterThan(before);

    await page.getByTestId("clause-chip").filter({ hasText: "[16]" }).first().click();
    await expect(page.getByTestId("provenance")).toContainText("preannotation:claude");
  });

  test("affiche les fantômes Claude quand l'overlay est activé", async ({ page }) => {
    await page.getByTestId("toggle-ghost-claude").check();
    await expect(page.getByTestId("ghost-claude-0")).toBeVisible();
  });

  test("Préférences : replier l'inspecteur depuis le popover (état PAR COMPTE)", async ({ page }) => {
    // L'inspecteur est ouvert par défaut.
    await expect(page.getByTestId("inspector-scroll")).toBeVisible();
    await page.getByTestId("prefs-toggle").click();
    await expect(page.getByTestId("prefs-card")).toBeVisible();
    // Replier l'inspecteur via le switch « Inspecteur ouvert ».
    await page.getByTestId("prefs-panel-inspectorOpen").click();
    // Le rail replié apparaît (bouton de dépliage) → l'état a bien piloté l'UI.
    await expect(page.getByTestId("inspector-expand")).toBeVisible();
    // Réinitialiser remet l'inspecteur ouvert.
    await page.getByTestId("prefs-reset").click();
    await expect(page.getByTestId("inspector-scroll")).toBeVisible();
  });
});
