import { test, expect } from "@playwright/test";

/**
 * F9 — Commentaires ancrés (justifier le choix). Squelette structuré : ouvre une
 * clause, poste un commentaire, le résout.
 */

test.describe("Commentaires (F9)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();
    await page.getByTestId("sentence-0").click();
  });

  test("poste un commentaire sur la clause", async ({ page }) => {
    await page.getByTestId("comment-input").fill("Vérifier la formulation exacte.");
    await page.getByTestId("comment-submit").click();
    await expect(page.getByTestId("comment-item").last()).toContainText(
      "Vérifier la formulation",
    );
  });

  test.fixme("résout un fil de commentaires", async () => {
    // TODO : cliquer resolve-comment et vérifier l'état « résolu ».
  });
});
