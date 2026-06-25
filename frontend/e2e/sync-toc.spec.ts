import { test, expect } from "@playwright/test";

/**
 * Synchro phrase → block (dossier docs/pactiva/dossier-sync-phrase-block) : sélectionner
 * une phrase (ancre OU phrase couverte non-ancre d'un run) presse le chip de la clause
 * correspondante dans le plan (aside gauche).
 */
test.describe("Synchro plan ↔ phrase", () => {
  test("le plan se replie en rail et se déplie (dock bilatéral, L1)", async ({ page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();
    const plan = page.getByRole("complementary", { name: "Plan du document" });
    await expect(plan).toBeVisible();
    // Replier → rail fin + bouton de dépliage (le plan plein disparaît, libère l'espace).
    await page.getByTestId("sidebar-collapse").click();
    await expect(page.getByTestId("sidebar-expand")).toBeVisible();
    await expect(plan).toHaveCount(0);
    // Déplier → plan de retour (symétrique de l'inspecteur).
    await page.getByTestId("sidebar-expand").click();
    await expect(plan).toBeVisible();
  });

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

  test("le plan affiche UN bloc par phrase non annotée + couverture + saut", async ({ page }) => {
    // Correctif « blocks manquants » : sur un document partiellement annoté, le plan doit
    // afficher UN bloc « à annoter » par phrase non annotée (pas un résumé), au lieu de ne
    // lister que les clauses (qui faisait croire à des blocks disparus).
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();
    const toc = page.getByRole("complementary", { name: "Plan du document" });

    // Encart de couverture (Fitbit n'est que partiellement annoté).
    await expect(toc.getByTestId("toc-coverage")).toContainText("restante");
    // Au moins un bloc « à annoter » cliquable.
    const empty = toc.getByTestId("plan-empty").first();
    await expect(empty).toBeVisible();
    await expect(empty).toContainText("à annoter");

    // Le bouton « Prochaine non annotée » déplace le focus document vers une phrase libre.
    await toc.getByTestId("toc-goto-gap").click();
    await expect(page.locator('[data-testid^="sentence-"][data-focused="true"]')).toHaveCount(1);
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
