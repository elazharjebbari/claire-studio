import { test, expect } from "@playwright/test";

/**
 * F3 — Historique & versions : timeline + diff. Squelette structuré.
 */

test.describe("Historique (F3)", () => {
  test("affiche la timeline des versions", async ({ page }) => {
    await page.goto("/history/ann-1");
    await expect(page.getByTestId("version-item").first()).toBeVisible();
  });

  test.fixme("ouvre le diff entre deux versions", async () => {
    // TODO : naviguer vers .../versions/{n}/diff.
  });
});
