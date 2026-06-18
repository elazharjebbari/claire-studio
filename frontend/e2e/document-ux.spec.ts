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

  test("l'overlay frontières est togglable (pointillés au début de run)", async ({ page }) => {
    // Le 1er début de clause humaine porte data-boundary + data-dashed quand ON.
    const firstBoundary = page.locator('[data-boundary="true"]').first();
    await expect(firstBoundary).toHaveAttribute("data-dashed", "true");

    await page.getByTestId("boundary-toggle").uncheck();
    await expect(page.locator('[data-dashed="true"]')).toHaveCount(0);

    await page.getByTestId("boundary-toggle").check();
    await expect(page.locator('[data-dashed="true"]').first()).toBeVisible();
  });

  test("le clic-droit ouvre le menu de phrase avec le bloc LLM", async ({ page }) => {
    await page.getByTestId("sentence-2").click({ button: "right" });
    await expect(page.getByTestId("sentence-menu")).toBeVisible();
    await expect(page.getByTestId("menu-llm")).toBeVisible();
    await expect(page.getByTestId("menu-translate")).toBeVisible();
    // Fermeture à Échap.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("sentence-menu")).toHaveCount(0);
  });

  test("Shift+clic crée une multi-sélection et affiche la barre d'actions", async ({ page }) => {
    await page.getByTestId("sentence-2").click();
    await page.getByTestId("sentence-4").click({ modifiers: ["Shift"] });
    await expect(page.getByTestId("selection-toolbar")).toBeVisible();
    await expect(page.getByTestId("selection-count")).toContainText("3");
  });

  test("« Traduire le document » affiche la ligne FR", async ({ page }) => {
    await page.getByTestId("translate-document").click();
    await expect(page.getByTestId("translation-0")).toBeVisible();
  });
});
