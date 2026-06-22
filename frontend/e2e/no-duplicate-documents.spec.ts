import { test, expect, type Page } from "@playwright/test";

/**
 * Non-régression (ADR-001) — anti-duplication des documents.
 *
 * Garde-fou direct du bug observé en prod sur la campagne (chaque document affiché
 * plusieurs fois). Le sélecteur de documents du workspace ne doit afficher qu'UNE
 * entrée par document (source : /projects/{slug}/documents, déduplication par
 * construction + défensive côté hook), quel que soit le nombre d'annotateurs.
 */

test.use({ viewport: { width: 1440, height: 900 } });

async function open(page: Page) {
  await page.goto("/annotate/ann-1");
  await expect(page.getByTestId("annotation-workspace")).toBeVisible();
}

test.describe("Anti-duplication des documents (ADR-001)", () => {
  test("le sélecteur n'affiche qu'une entrée par document", async ({ page }) => {
    await open(page);
    await page.getByTestId("document-switcher-button").click();
    await expect(page.getByTestId("document-search")).toBeVisible();

    // Aucune option de document ne doit apparaître en double (testid unique par doc).
    const options = page.locator('[data-testid^="document-option-"]');
    const count = await options.count();
    expect(count).toBeGreaterThan(0);
    const ids = await options.evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-testid")),
    );
    expect(new Set(ids).size).toBe(ids.length); // tous distincts → zéro doublon
  });

  test("le document courant (Fitbit) reste une option unique après recherche", async ({
    page,
  }) => {
    await open(page);
    await page.getByTestId("document-switcher-button").click();
    await page.getByTestId("document-search").fill("fit");
    await expect(page.getByTestId("document-option-doc-fitbit")).toHaveCount(1);
  });
});
