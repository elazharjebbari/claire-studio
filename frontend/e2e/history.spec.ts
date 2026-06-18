import { test, expect } from "@playwright/test";

/**
 * F3 — Historique & versions : timeline des AnnotationVersion + diff réel entre
 * deux versions (clauses ajoutées / supprimées / modifiées par anchor_index et
 * thème). S'appuie sur MSW (3 versions du document Fitbit avec évolution réelle).
 */

test.describe("Historique & diff (F3)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/history/ann-1");
    await expect(page.getByTestId("version-item").first()).toBeVisible();
  });

  test("affiche la timeline des versions", async ({ page }) => {
    // 3 versions dans les fixtures.
    await expect(page.getByTestId("version-item")).toHaveCount(3);
  });

  test("affiche par défaut le diff entre les deux dernières versions", async ({ page }) => {
    const diff = page.getByTestId("diff-view");
    await expect(diff).toBeVisible();
    // v2 → v3 : TERMINATION (ancre 16) supprimé, LICENSE_IP (ancre 10) ajouté.
    await expect(page.getByTestId("diff-row-16")).toHaveAttribute("data-diff-status", "removed");
    await expect(page.getByTestId("diff-row-10")).toHaveAttribute("data-diff-status", "added");
  });

  test("recompose le diff entre deux versions choisies (v1 → v2)", async ({ page }) => {
    // Choisit la version 1 comme base et la version 2 comme cible.
    await page.getByTestId("select-from-1").click();
    await page.getByTestId("select-to-2").click();

    const diff = page.getByTestId("diff-view");
    await expect(diff).toBeVisible();
    // v1 → v2 : ancre 2 reclassée (PREAMBLE_SCOPE → MODIFICATION_OF_TERMS) = modifiée.
    await expect(page.getByTestId("diff-row-2")).toHaveAttribute("data-diff-status", "modified");
    await expect(page.getByTestId("diff-row-2")).toContainText("Thème");
    // Ancres 7 et 16 ajoutées en v2.
    await expect(page.getByTestId("diff-row-7")).toHaveAttribute("data-diff-status", "added");
    await expect(page.getByTestId("diff-row-16")).toHaveAttribute("data-diff-status", "added");
    // Résumé du diff visible.
    await expect(page.getByTestId("diff-summary")).toBeVisible();
  });
});
