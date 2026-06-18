import { test, expect } from "@playwright/test";

/**
 * F9 — Commentaires ancrés (justifier le choix). Ouvre une clause, poste un
 * commentaire, le résout. S'appuie sur MSW (fixtures partagées).
 */

test.describe("Commentaires (F9)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();
    // Sélectionne une clause existante (ancre 0) pour ouvrir l'inspecteur.
    await page.getByTestId("sentence-0").click();
    await expect(page.getByTestId("inspector")).toBeVisible();
  });

  test("poste un commentaire sur la clause", async ({ page }) => {
    const thread = page.getByTestId("comment-thread");
    await page.getByTestId("comment-input").fill("Vérifier la formulation exacte.");
    await page.getByTestId("comment-submit").click();
    await expect(thread.getByTestId("comment-item").last()).toContainText(
      "Vérifier la formulation",
    );
  });

  test("résout un fil de commentaires", async ({ page }) => {
    // On poste d'abord pour garantir un commentaire non résolu sur cette clause.
    await page.getByTestId("comment-input").fill("À discuter en revue.");
    await page.getByTestId("comment-submit").click();

    const lastComment = page.getByTestId("comment-item").last();
    await expect(lastComment).toContainText("À discuter");
    await lastComment.getByTestId("resolve-comment").click();
    await expect(lastComment).toContainText("résolu");
    await expect(lastComment.getByTestId("resolve-comment")).toHaveCount(0);
  });
});
