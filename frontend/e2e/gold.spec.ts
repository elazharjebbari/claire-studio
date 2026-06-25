import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Golden-path RÉSOLUTION GOLD (servi par le worker MSW, sans backend) :
 * cockpit → atelier → verrou → décision → modale d'aide, + scan a11y.
 *
 * Auth : AuthGuard inerte en mode mock (NEXT_PUBLIC_ENABLE_MOCKS) ; FIXTURE_USER = admin.
 * Limite connue : decide/lock renvoient des réponses statiques (pas de mutation serveur) —
 * on asserte donc les AFFORDANCES/visibilité, pas une progression cumulée.
 */

const SLUG = "claudette-gold-v1";
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.describe("Résolution GOLD (golden-path)", () => {
  test("cockpit → atelier → verrou → décision", async ({ page }) => {
    await page.goto(`/projects/${SLUG}/gold`);
    await expect(page.getByTestId("gold-cockpit")).toBeVisible();

    // Aide contextuelle.
    await page.getByTestId("gold-help-open").click();
    await expect(page.getByTestId("gold-help-modal")).toBeVisible();
    await expect(page.getByTestId("gold-help-llm-reference")).toContainText(/référence/i);
    await page.getByTestId("gold-help-close").click();
    await expect(page.getByTestId("gold-help-modal")).toHaveCount(0);

    // Entrer dans l'atelier d'un document.
    await page.getByTestId("gold-doc-Atlas").click();
    await expect(page.getByTestId("gold-workspace")).toBeVisible();

    // Lecture seule tant que le verrou n'est pas pris.
    await expect(page.getByTestId("gold-lock-acquire")).toBeVisible();
    await page.getByTestId("gold-lock-acquire").click();
    await expect(page.getByTestId("gold-lock-mine")).toBeVisible();

    // Arbitrer une phrase en divergence (index 1 : alice PRIVACY vs bob LIABILITY).
    await page.getByTestId("gold-row-1").click();
    await expect(page.getByTestId("gold-inspector")).toContainText("Phrase 1");
    // Les candidats de décision sont les propositions des ANNOTATEURS (verrou détenu).
    await expect(page.getByTestId("gold-decide-PRIVACY")).toBeVisible();
    await page.getByTestId("gold-decide-PRIVACY").click();

    // Retour cockpit.
    await page.getByTestId("gold-back").click();
    await expect(page.getByTestId("gold-cockpit")).toBeVisible();
  });

  test("a11y : pas de violation sérieuse (cockpit & atelier)", async ({ page }) => {
    for (const route of [`/projects/${SLUG}/gold`, `/projects/${SLUG}/gold/Atlas`]) {
      await page.goto(route);
      await expect(
        page.getByTestId(route.endsWith("/gold") ? "gold-cockpit" : "gold-workspace"),
      ).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
    }
  });
});
