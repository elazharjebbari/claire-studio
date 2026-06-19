import { test, expect, type Page } from "@playwright/test";

/**
 * Comparaison & arbitrage LLM (points 1–5) :
 *  - navigation des divergences (flèches + n/p),
 *  - arbitrage par proposition (menu) + voyant,
 *  - sélecteur de version non destructif,
 *  - panneau comparatif,
 *  - aperçu de frontière + adoption,
 *  - menu clic-droit borné au viewport (P2).
 */

test.use({ viewport: { width: 1440, height: 900 } });

async function openCompare(page: Page) {
  await page.goto("/annotate/ann-1");
  await expect(page.getByTestId("annotation-workspace")).toBeVisible();
  await page.getByTestId("llm-compare").click();
  await expect(page.getByTestId("compare-banner")).toBeVisible();
}

test.describe("Comparaison & arbitrage LLM", () => {
  test("navigue de divergence en divergence (flèches + n/p)", async ({ page }) => {
    await openCompare(page);
    const nav = page.getByTestId("divergence-nav");
    await expect(nav).toBeVisible();
    // Au départ, phrase 0 (accord) → hors divergence.
    await expect(page.getByTestId("divergence-counter")).toContainText("/");

    await page.getByTestId("divergence-next").click();
    await expect(page.getByTestId("divergence-counter")).toContainText("1 /");

    // Raccourci clavier n → divergence suivante (ordinal 2).
    await page.keyboard.press("n");
    await expect(page.getByTestId("divergence-counter")).toContainText("2 /");

    // p revient à la précédente (ordinal 1).
    await page.keyboard.press("p");
    await expect(page.getByTestId("divergence-counter")).toContainText("1 /");
  });

  test("arbitre une divergence via le menu et affiche le voyant", async ({ page }) => {
    await openCompare(page);
    // Phrase 1 : Claude=MODIFICATION_OF_TERMS, Codex=META (divergence).
    await page.getByTestId("sentence-1").click({ button: "right" });
    await expect(page.getByTestId("sentence-menu")).toBeVisible();
    await page.getByTestId("menu-llm-claude-adopt").click();
    // Voyant d'arbitrage sur la clause (Claude adopté).
    const voyant = page.getByTestId("resolved-1");
    await expect(voyant).toBeVisible();
    await expect(voyant).toHaveAttribute("data-judge", "claude");
  });

  test("adoption au clavier 1 = Claude sur la divergence courante", async ({ page }) => {
    await openCompare(page);
    await page.getByTestId("divergence-next").click(); // cible la 1re divergence (phrase 1)
    await page.keyboard.press("1");
    await expect(page.getByTestId("resolved-1")).toBeVisible();
  });

  test("le sélecteur de version est visible et change sans perturber l'annotation", async ({
    page,
  }) => {
    await openCompare(page);
    const select = page.getByTestId("llm-version-select");
    await expect(select).toBeVisible();
    // Une clause humaine existante (ancre 0, META) avant le switch.
    const planChip0 = page
      .getByRole("complementary", { name: "Plan du document" })
      .getByTestId("clause-chip")
      .filter({ hasText: "[0]" });
    await expect(planChip0).toBeVisible();
    await select.selectOption("v9.2");
    // La clause humaine est toujours là après le switch (non destructif).
    await expect(planChip0).toBeVisible();
  });

  test("le panneau comparatif s'ouvre et permet de sauter à une phrase", async ({ page }) => {
    await openCompare(page);
    await page.keyboard.press("g");
    await expect(page.getByTestId("compare-panel")).toBeVisible();
    await expect(page.getByTestId("compare-claude")).toBeVisible();
    await expect(page.getByTestId("compare-codex")).toBeVisible();
    // Cliquer un bloc Codex saute au focus correspondant.
    await page.getByTestId("compare-codex-block-16").click();
    await expect(page.getByTestId("sentence-16")).toHaveAttribute("data-focused", "true");
  });

  test("aperçu de frontière : preuves + adoption (P5)", async ({ page }) => {
    await openCompare(page);
    // Icône d'aperçu sur la frontière de la phrase 16 (résiliation chez les 2 juges).
    await page.getByTestId("boundary-peek-16").click();
    await expect(page.getByTestId("boundary-evidence")).toBeVisible();
    await expect(page.getByTestId("boundary-card-claude")).toBeVisible();
    await page.getByTestId("boundary-adopt-claude").click();
    await expect(page.getByTestId("resolved-16")).toBeVisible();
  });

  test("le menu clic-droit reste entièrement dans le viewport (P2)", async ({ page }) => {
    await openCompare(page);
    const vh = page.viewportSize()!.height;
    // Clic-droit sur une phrase proche du bas.
    await page.getByTestId("sentence-30").scrollIntoViewIfNeeded();
    await page.getByTestId("sentence-30").click({ button: "right" });
    const menu = page.getByTestId("sentence-menu");
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    // Le bas du menu ne dépasse pas le bas du viewport.
    expect(box!.y + box!.height).toBeLessThanOrEqual(vh + 1);
    expect(box!.y).toBeGreaterThanOrEqual(0);
  });
});
