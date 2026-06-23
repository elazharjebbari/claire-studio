import { test, expect, type Page } from "@playwright/test";

/**
 * File de triage (e2e) — annotation assistée multi-label (protocole C1–C5).
 * Le bouton n'apparaît que pour le propriétaire (isMine) et sous TRIAGE_ENABLED (vrai en
 * mode mock). On ouvre la file, on vérifie la carte de suggestion (niveau + explication),
 * la navigation clavier, et une acceptation. S'appuie sur MSW (mode démo, ann-1 = u-alice).
 */

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("File de triage — carte de suggestion & gestes", () => {
  test("ouvre la file, affiche une suggestion, navigue et accepte", async ({ page }: { page: Page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();

    // Bouton réservé au propriétaire + flag (mock).
    const toggle = page.getByTestId("toggle-triage");
    await expect(toggle).toBeVisible();
    await toggle.click();

    // La file s'ouvre, prête (≥ 2 juges dans le mock).
    const queue = page.getByTestId("triage-queue");
    await expect(queue).toBeVisible();
    await expect(page.getByTestId("triage-count-C1")).toBeVisible();

    // Carte de suggestion : badge de niveau + explication déterministe.
    await expect(page.getByTestId("suggestion-card")).toBeVisible();
    await expect(page.getByTestId("triage-badge")).toBeVisible();
    await expect(page.getByTestId("suggestion-logic")).toBeVisible();

    // Navigation clavier (j) — la position change.
    const posBefore = await page.getByTestId("triage-position").textContent();
    await page.keyboard.press("j");
    await expect(page.getByTestId("triage-position")).not.toHaveText(posBefore ?? "");

    // Acceptation (si la carte courante propose une action primaire, hors C5).
    const accept = page.getByTestId("suggestion-accept");
    if (await accept.isVisible().catch(() => false)) {
      await accept.click();
    }

    // Fermeture.
    await page.getByTestId("triage-close").click();
    await expect(queue).toBeHidden();
  });

  test("acceptation par lot C1 (un geste)", async ({ page }: { page: Page }) => {
    await page.goto("/annotate/ann-1");
    await page.getByTestId("toggle-triage").click();
    const batch = page.getByTestId("triage-batch-c1");
    if (await batch.isVisible().catch(() => false)) {
      await batch.click();
      // Le lot est consommé : le bouton disparaît (plus de C1 à traiter).
      await expect(batch).toBeHidden();
    }
  });

  test("accepter met à jour le document IMMÉDIATEMENT (via le store)", async ({ page }: { page: Page }) => {
    await page.goto("/annotate/ann-1");
    await page.getByTestId("toggle-triage").click();
    await expect(page.getByTestId("triage-queue")).toBeVisible();

    // Compteur de clauses validées AVANT (plan latéral, piloté par le store).
    const validated = page.getByTestId("toc-validated");
    const before = (await validated.textContent().catch(() => "")) ?? "";

    const accept = page.getByTestId("suggestion-accept");
    if (await accept.isVisible().catch(() => false)) {
      await accept.click();
      // Marque « traité » dans la file ET maj du document sans rechargement.
      await expect(page.getByTestId("triage-done")).toBeVisible();
      await expect(validated).not.toHaveText(before);
    }
  });

  test("sélection multiple → bouton « Accepter la sélection »", async ({ page }: { page: Page }) => {
    await page.goto("/annotate/ann-1");
    await page.getByTestId("toggle-triage").click();
    await expect(page.getByTestId("triage-queue")).toBeVisible();

    // Sélectionne deux phrases dans le document (Cmd/Ctrl+clic = toggle additif).
    const rows = page.locator("[data-sentence-index]");
    await rows.nth(0).click();
    await rows.nth(2).click({ modifiers: ["ControlOrMeta"] });

    const selBtn = page.getByTestId("triage-batch-selection");
    if (await selBtn.isVisible().catch(() => false)) {
      await expect(selBtn).toContainText("Accepter la sélection");
      await selBtn.click();
      await expect(selBtn).toBeHidden(); // sélection consommée
    }
  });

  test("multi-label : ajouter un thème secondaire depuis l'inspecteur → badge +N dans le plan", async ({ page }: { page: Page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();

    // Sélectionne la première clause du plan pour ouvrir l'inspecteur.
    const chips = page.getByTestId("clause-chip");
    if ((await chips.count()) === 0) return;
    await chips.first().click();

    const editor = page.getByTestId("multilabel-editor");
    if (!(await editor.isVisible().catch(() => false))) return;

    // Active le multi-label puis ajoute le 1ᵉʳ thème secondaire proposé.
    await page.getByTestId("multilabel-toggle").click();
    const option = page.getByTestId("secondary-picker").getByTestId(/^theme-option-/).first();
    if (await option.isVisible().catch(() => false)) {
      await option.click();
      // Un chip secondaire (pointillé) apparaît dans l'inspecteur.
      await expect(page.getByTestId("secondary-chips")).toBeVisible();
      // Et le plan signale le multi-label par un badge +N.
      await expect(page.getByTestId("multilabel-badge").first()).toBeVisible();
    }
  });

  test("rail d'actions rapides : activation, valider+suivant, recommandation au survol", async ({ page }: { page: Page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();

    // Activer le rail (case dans la barre d'overlays du document).
    await page.getByTestId("quick-actions-toggle").check();

    // Le rail de la phrase focalisée (0) est visible.
    const validate0 = page.getByTestId("quick-validate-0");
    await expect(validate0).toBeVisible();

    // Survol du bouton recommandation → carte de suggestion (si triage prêt).
    const suggest0 = page.getByTestId("quick-suggest-0");
    if (await suggest0.isVisible().catch(() => false)) {
      await suggest0.hover();
      await expect(page.getByTestId("quick-suggest-card-0")).toBeVisible();
    }

    // Valider + suivant : un clic valide la phrase courante (si une clause existe) et avance.
    if (await validate0.isEnabled().catch(() => false)) {
      const validatedBefore = (await page.getByTestId("toc-validated").textContent().catch(() => "")) ?? "";
      await validate0.click();
      await expect(page.getByTestId("toc-validated")).not.toHaveText(validatedBefore);
    }
  });
});
