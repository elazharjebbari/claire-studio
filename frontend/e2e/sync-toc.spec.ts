import { test, expect } from "@playwright/test";

/**
 * Synchro phrase → block (dossier docs/pactiva/dossier-sync-phrase-block) : sélectionner
 * une phrase (ancre OU phrase couverte non-ancre d'un run) presse le chip de la clause
 * correspondante dans le plan (aside gauche).
 */
test.describe("Synchro plan ↔ phrase", () => {
  test("clic d'une phrase annotée → chip de sa clause pressé ; bascule entre clauses", async ({ page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();

    const toc = page.getByRole("complementary", { name: "Plan du document" });
    const chip0 = toc.getByTestId("clause-chip").filter({ hasText: "[0]" });
    const chip2 = toc.getByTestId("clause-chip").filter({ hasText: "[2]" });
    await expect(chip0).toBeVisible();

    // Clic de la phrase 0 (clause [0]) → chip [0] pressé ET visible (scroll auto de l'aside).
    await page.getByTestId("sentence-0").click();
    await expect(chip0).toHaveAttribute("aria-pressed", "true");
    await expect(chip0).toBeInViewport();

    // Clic d'une autre clause (phrase 2) → chip [2] pressé, chip [0] relâché.
    await page.getByTestId("sentence-2").click();
    await expect(chip2).toHaveAttribute("aria-pressed", "true");
    await expect(chip0).toHaveAttribute("aria-pressed", "false");

    // Phrase non annotée (inter-clauses, modèle par phrase) → aucune clause sélectionnée.
    await page.getByTestId("sentence-1").click();
    await expect(chip2).toHaveAttribute("aria-pressed", "false");
  });

  test("le plan REMPLIT l'aside : les overlays sont épinglés en bas (pas de zone vide)", async ({ page }) => {
    // Régression du « bas vide » (dossier docs/pactiva/dossier-statuts-concordance) :
    // quand le plan est court, l'aside gauche ne doit pas laisser une grande bande vide
    // sous les overlays — la liste de clauses s'étire et les overlays restent collés au bas.
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();
    const aside = page.getByRole("complementary", { name: "Plan du document" });
    const overlays = page.getByTestId("toc-overlays");
    await expect(overlays).toBeVisible();
    const a = await aside.boundingBox();
    const o = await overlays.boundingBox();
    expect(a).not.toBeNull();
    expect(o).not.toBeNull();
    // Bas des overlays ≈ bas de l'aside (au padding p-3 près). Avant le correctif :
    // ~283px d'écart. Tolérance large (≤ 40px) pour absorber padding + bordures.
    const gap = a!.y + a!.height - (o!.y + o!.height);
    expect(gap).toBeLessThanOrEqual(40);
  });

  test("round-trip : clic chip → phrase focalisée → re-presse le chip", async ({ page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();
    const toc = page.getByRole("complementary", { name: "Plan du document" });
    const chip4 = toc.getByTestId("clause-chip").filter({ hasText: "[4]" });
    await chip4.click();
    await expect(chip4).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("sentence-4")).toHaveAttribute("data-focused", "true");
  });
});
