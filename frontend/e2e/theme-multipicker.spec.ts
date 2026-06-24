import { test, expect } from "@playwright/test";

/**
 * Sélecteur de thèmes UNIFIÉ (clic-droit) — dossier docs/pactiva/dossier-theme-multipicker.
 * Une seule grille : 1ᵉʳ clic = principal (★), suivants = secondaires numérotés, ★ promeut,
 * re-clic retire.
 */
test.use({ viewport: { width: 1440, height: 900 } });

test.describe("Grille de thèmes unifiée (primaire + secondaires)", () => {
  test("choisir un principal puis un secondaire, puis promouvoir", async ({ page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();

    // Clic-droit sur une phrase non annotée → menu + grille unifiée.
    await page.getByTestId("sentence-12").click({ button: "right" });
    const menu = page.getByTestId("sentence-menu");
    await expect(menu).toBeVisible();
    const picker = menu.getByTestId("theme-multipicker");
    await expect(picker).toBeVisible();

    // 1ᵉʳ clic = thème PRINCIPAL (crée la clause).
    await picker.getByTestId("theme-option-TERMINATION").click();
    await expect(picker.getByTestId("primary-badge-TERMINATION")).toBeVisible();

    // 2ᵉ clic = thème SECONDAIRE, ordre 1.
    await picker.getByTestId("theme-option-LIMITATION_LIABILITY").click();
    await expect(picker.getByTestId("secondary-order-LIMITATION_LIABILITY")).toHaveText("1");
    await expect(picker.getByTestId("multipicker-summary")).toContainText("1 secondaire");

    // ★ promeut le secondaire en principal (l'ancien principal redevient secondaire).
    await picker.getByTestId("promote-LIMITATION_LIABILITY").click();
    await expect(picker.getByTestId("primary-badge-LIMITATION_LIABILITY")).toBeVisible();
    await expect(picker.getByTestId("secondary-order-TERMINATION")).toBeVisible();

    // Re-clic d'un secondaire le retire.
    await picker.getByTestId("theme-option-TERMINATION").click();
    await expect(picker.getByTestId("secondary-order-TERMINATION")).toHaveCount(0);
  });

  test("refuge non sélectionnable en secondaire", async ({ page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();
    await page.getByTestId("sentence-13").click({ button: "right" });
    const picker = page.getByTestId("sentence-menu").getByTestId("theme-multipicker");
    // Principal non-refuge.
    await picker.getByTestId("theme-option-TERMINATION").click();
    await expect(picker.getByTestId("primary-badge-TERMINATION")).toBeVisible();
    // Le refuge PREAMBLE_SCOPE est désactivé en secondaire.
    await expect(picker.getByTestId("theme-option-PREAMBLE_SCOPE")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
