import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Audit d'accessibilité (axe-core) sur les surfaces principales : accueil et
 * workspace d'annotation. On échoue sur les violations sérieuses/critiques (WCAG 2
 * A & AA), ce qui couvre labels manquants, rôles, et contrastes insuffisants.
 *
 * Référence design system : thème sombre anti-fatigue, contraste AA (F6).
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.describe("Accessibilité (axe-core)", () => {
  test("la page reviewer (racine) n'a pas de violation sérieuse/critique", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /A Thematic Layer for CLAUDETTE/i })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, serious.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
  });

  test("l'accueil n'a pas de violation sérieuse/critique", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "Atelier Pactiva" })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      serious,
      serious.map((v) => `${v.id}: ${v.help}`).join("\n"),
    ).toEqual([]);
  });

  test("le workspace d'annotation n'a pas de violation sérieuse/critique", async ({ page }) => {
    // Canevas riche (overlay triage + rail d'actions rapides ON par défaut) → axe analyse
    // beaucoup d'éléments ; on triple le budget temps (test légitimement lent, pas flaky).
    test.slow();
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      // Le document est un canevas d'annotation : on cible la chrome + l'inspecteur.
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      serious,
      serious.map((v) => `${v.id}: ${v.help}`).join("\n"),
    ).toEqual([]);
  });
});
