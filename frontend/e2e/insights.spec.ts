import { test, expect } from "@playwright/test";

/**
 * Point 5 — écran d'exploration des annotations humaines (corpus + document).
 */

test.describe("Insights des annotations humaines (point 5)", () => {
  test("vue corpus : KPI, distribution des thèmes, table des documents", async ({ page }) => {
    await page.goto("/projects/claudette-gold-v1/insights");
    await expect(page.getByTestId("corpus-insights")).toBeVisible();
    await expect(page.getByTestId("theme-distribution")).toBeVisible();
    await expect(page.getByTestId("insights-doc-doc-fitbit")).toBeVisible();
  });

  test("drill-down document : KPI, certitude par clause, ajout de remarque", async ({ page }) => {
    await page.goto("/projects/claudette-gold-v1/insights");
    await page.getByTestId("insights-doc-doc-fitbit").click();
    await expect(page.getByTestId("document-insights")).toBeVisible();
    await expect(page.getByTestId("clause-certainty")).toBeVisible();
    // Ajout d'une remarque de qualification (scope document).
    await page.getByTestId("remark-body").fill("Annotation soignée, divergences résolues.");
    await page.getByTestId("remark-add").click();
    await expect(
      page.getByTestId("remarks-list").getByText("Annotation soignée, divergences résolues."),
    ).toBeVisible();
  });
});
