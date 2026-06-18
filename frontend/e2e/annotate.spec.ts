import { test, expect } from "@playwright/test";

/**
 * F1 — Simplifier l'annotation humaine. Couvre : ouverture du workspace 3 panneaux,
 * pose d'une frontière de clause au clic et au clavier (B), édition du thème,
 * certitude clavier (0–3), snapshot.
 */

test.describe("Workspace d'annotation (F1)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();
  });

  test("affiche les trois panneaux", async ({ page }) => {
    await expect(page.getByRole("complementary", { name: "Plan du document" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Document" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Inspecteur" })).toBeVisible();
  });

  test("le clic seul n'annote PAS ; choisir un thème crée la clause", async ({ page }) => {
    // Phrase sans clause (index 12) : le clic ne doit créer aucune clause (plus
    // d'auto « Boilerplate divers ») — il ouvre l'état « créer une clause ».
    await page.getByTestId("sentence-12").click();
    await expect(page.getByTestId("inspector")).toBeVisible();
    await expect(page.getByTestId("inspector-no-clause")).toBeVisible();
    const planChip = page
      .getByRole("complementary", { name: "Plan du document" })
      .getByTestId("clause-chip")
      .filter({ hasText: "[12]" });
    await expect(planChip).toHaveCount(0); // rien créé au simple clic
    // Choix explicite d'un thème → la clause est créée.
    await page.getByTestId("inspector").getByTestId("theme-option-TERMINATION").click();
    await expect(planChip).toBeVisible();
  });

  test("la touche B ouvre la palette de thème (pas d'auto-Boilerplate)", async ({ page }) => {
    await page.getByTestId("sentence-9").click(); // non-ancre
    await page.keyboard.press("b");
    // La création reste explicite : la palette est proposée, aucune clause auto-créée.
    await expect(page.getByTestId("inspector").getByTestId("theme-palette")).toBeVisible();
    await expect(
      page
        .getByRole("complementary", { name: "Plan du document" })
        .getByTestId("clause-chip")
        .filter({ hasText: "[9]" }),
    ).toHaveCount(0);
  });

  test("règle la certitude d'une clause existante", async ({ page }) => {
    await page.getByTestId("sentence-0").click(); // ancre META existante (fixtures)
    const c3 = page.getByTestId("inspector").getByTestId("certainty-3");
    await expect(c3).toBeVisible();
    await c3.click();
    await expect(c3).toHaveAttribute("aria-checked", "true");
  });

  test("change le thème via la palette", async ({ page }) => {
    await page.getByTestId("sentence-22").click();
    const input = page.getByLabel("Rechercher un thème");
    await input.fill("arbitrage");
    await page.getByTestId("theme-option-ARBITRATION_DISPUTES").click();
    // La clause sélectionnée de l'inspecteur reflète le nouveau thème.
    await expect(
      page.getByTestId("inspector").getByTestId("clause-chip").filter({ hasText: "Arbitrage" }),
    ).toBeVisible();
  });

  test("snapshot via le bouton", async ({ page }) => {
    await page.getByTestId("snapshot-btn").click();
    await expect(page.getByTestId("snapshot-msg")).toBeVisible();
  });
});
