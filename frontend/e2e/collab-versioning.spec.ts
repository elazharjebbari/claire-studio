import { test, expect, type Page } from "@playwright/test";

/**
 * Points 0, 1, 2 : pré-remplissage commutable, navigation documents (voyant draft +
 * recherche), en-tête sticky, soumission versionnée, historique d'actions.
 */

test.use({ viewport: { width: 1440, height: 900 } });

async function open(page: Page) {
  await page.goto("/annotate/ann-1");
  await expect(page.getByTestId("annotation-workspace")).toBeVisible();
}

test.describe("Collaboration & versioning — socle (points 0,1,2)", () => {
  test("le pré-remplissage bascule réellement entre Claude et Codex (point 0a)", async ({
    page,
  }) => {
    await open(page);
    const claude = page.getByTestId("prefill-claude");
    const codex = page.getByTestId("prefill-codex");
    // La session a déjà des clauses → chaque bascule demande CONFIRMATION d'écrasement.
    await claude.click();
    await page.getByTestId("prefill-confirm-ok").click();
    // 1ère exécution manuelle → modale de consentement auto-prefill : on refuse pour continuer.
    const decline = page.getByTestId("auto-prefill-decline");
    if (await decline.isVisible().catch(() => false)) await decline.click();
    await expect(claude).toHaveAttribute("aria-checked", "true");
    await codex.click();
    await page.getByTestId("prefill-confirm-ok").click();
    await expect(codex).toHaveAttribute("aria-checked", "true");
    await expect(claude).toHaveAttribute("aria-checked", "false");
    // Retour à "Aucun" : appliqué directement (pas d'écrasement à confirmer).
    await page.getByTestId("prefill-none").click();
    await expect(page.getByTestId("prefill-none")).toHaveAttribute("aria-checked", "true");
  });

  test("la barre de documents cherche, affiche le voyant draft et navigue (point 0b)", async ({
    page,
  }) => {
    await open(page);
    // Crée une modif → dirty → voyant draft.
    await page.getByTestId("sentence-9").click();
    await page.getByTestId("inspector").getByTestId("theme-option-TERMINATION").click();
    await expect(page.getByTestId("draft-indicator")).toBeVisible();
    // Ouvre la barre + recherche.
    await page.getByTestId("document-switcher-button").click();
    await expect(page.getByTestId("document-search")).toBeVisible();
    await page.getByTestId("document-search").fill("fit");
    // Au moins une option (le document courant Fitbit) reste visible.
    await expect(page.getByTestId("document-option-doc-fitbit")).toBeVisible();
  });

  test("l'en-tête de contrôles reste sticky au scroll (point 1)", async ({ page }) => {
    await open(page);
    await expect(page.getByTestId("document-controls")).toBeVisible();
    await page.getByTestId("sentence-30").scrollIntoViewIfNeeded();
    // Toujours visible après défilement.
    await expect(page.getByTestId("document-controls")).toBeInViewport();
  });

  test("la soumission : dialog versionné + gate de complétude (points 2, d)", async ({ page }) => {
    await open(page);
    await page.getByTestId("submit-btn").click();
    const dialog = page.getByTestId("submit-dialog");
    await expect(dialog).toBeVisible();
    // Champs de version présents (nom requis + description).
    await expect(page.getByTestId("version-name")).toBeVisible();
    await expect(page.getByTestId("version-description")).toBeVisible();
    // Cette session n'est PAS entièrement validée → gate actif : confirmer reste
    // désactivé et la raison du blocage est affichée (garde-fou campagne, point d).
    await expect(page.getByTestId("submit-block-reason")).toBeVisible();
    await page.getByTestId("version-name").fill("v1 — relecture résiliation");
    await expect(page.getByTestId("submit-confirm")).toBeDisabled();
    // Fermeture du dialog.
    await page.getByTestId("submit-cancel").click();
    await expect(dialog).toBeHidden();
  });

  test("l'historique journalise les actions et recentre au clic (point 2)", async ({ page }) => {
    await open(page);
    // Une action humaine.
    await page.getByTestId("sentence-9").click();
    await page.getByTestId("inspector").getByTestId("theme-option-TERMINATION").click();
    await page.getByTestId("toggle-history").click();
    const panel = page.getByTestId("history-panel");
    await expect(panel).toBeVisible();
    // Au moins une entrée de création de clause.
    const entry = panel.getByText(/Clause .* créée @9/);
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(page.getByTestId("sentence-9")).toHaveAttribute("data-focused", "true");
  });

  test("annuler / rétablir une création de clause (point 4a)", async ({ page }) => {
    await open(page);
    await page.getByTestId("sentence-9").click();
    await page.getByTestId("inspector").getByTestId("theme-option-TERMINATION").click();
    const planChip = page
      .getByRole("complementary", { name: "Plan du document" })
      .getByTestId("clause-chip")
      .filter({ hasText: "[9]" });
    await expect(planChip).toBeVisible();

    await page.getByTestId("toggle-history").click();
    await page.getByTestId("undo-btn").click();
    await expect(planChip).toHaveCount(0); // clause annulée
    await page.getByTestId("redo-btn").click();
    await expect(planChip).toBeVisible(); // clause rétablie
  });

  test("commentaire multi-niveaux : ajout d'un commentaire général (point 3)", async ({ page }) => {
    await open(page);
    await page.getByTestId("toggle-comments").click();
    const panel = page.getByTestId("comments-panel");
    await expect(panel).toBeVisible();
    // Commentaires de démo présents (général, range, phrase).
    await expect(panel.getByTestId("comment-item").first()).toBeVisible();
    // Ajout d'un commentaire général.
    await page.getByTestId("comment-scope-document").click();
    await page.getByTestId("comment-body").fill("Relecture globale OK.");
    await page.getByTestId("comment-add").click();
    await expect(panel.getByText("Relecture globale OK.")).toBeVisible();
  });

  test("l'overlay d'attribution montre l'auteur sur les clauses (point 3)", async ({ page }) => {
    await open(page);
    await page.getByTestId("toggle-attribution").click();
    // La clause à l'ancre 0 (META, fixtures) porte une pastille d'auteur.
    await expect(page.getByTestId("attribution-0")).toBeVisible();
  });

  test("le fantôme LLM reste visible même sur une phrase ancrée (fix overlay)", async ({ page }) => {
    await open(page);
    await page.getByTestId("toggle-ghost-claude").click();
    // L'ancre 0 porte une clause humaine ET une proposition Claude → le fantôme
    // doit s'afficher (correctif : plus masqué par la présence d'une ancre humaine).
    await expect(page.getByTestId("ghost-claude-0")).toBeVisible();
  });

  test("l'inspecteur compare la source evidence/rationale (Vous/Claude/Codex)", async ({ page }) => {
    await open(page);
    await page.getByTestId("sentence-0").click();
    const cmp = page.getByTestId("inspector-source-compare");
    await expect(cmp).toBeVisible();
    await page.getByTestId("inspector-source-claude").click();
    await expect(page.getByTestId("inspector-source-content")).toBeVisible();
    await expect(page.getByTestId("inspector-source-adopt")).toBeVisible();
  });

  test("le sélecteur de document signale les traductions disponibles", async ({ page }) => {
    await open(page);
    await page.getByTestId("document-switcher-button").click();
    await expect(page.getByTestId("doc-translated-doc-fitbit")).toBeVisible();
  });

  test("la barre de divergences reste sticky + nav dans le panneau comparatif", async ({ page }) => {
    await open(page);
    await page.getByTestId("llm-compare").click();
    await expect(page.getByTestId("divergence-nav")).toBeVisible();
    await page.getByTestId("sentence-25").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("divergence-nav")).toBeInViewport();
    // Panneau comparatif : navigation des désaccords.
    await page.keyboard.press("g");
    await expect(page.getByTestId("compare-divergence-nav")).toBeVisible();
    await page.getByTestId("compare-divergence-next").click();
  });

  test("présence collaborative + génération d'un lien de partage (points 4b/7)", async ({ page }) => {
    await open(page);
    // Barre de présence visible (flag presence actif en mock) avec participants.
    await expect(page.getByTestId("collab-bar")).toBeVisible();
    await expect(page.getByTestId("presence-u-alice")).toBeVisible();
    // Invitation → génération d'un lien signé.
    await page.getByTestId("collab-invite").click();
    await expect(page.getByTestId("share-dialog")).toBeVisible();
    await page.getByTestId("share-generate").click();
    await expect(page.getByTestId("share-link")).toHaveValue(/\/join\/shr_/);
  });
});
