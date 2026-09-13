import { test, expect, type Page } from "@playwright/test";

/**
 * DÉMONSTRATION de bout en bout du module GOLD — contre le BACKEND RÉEL (pas de mock).
 *
 * Ce test rejoue, PAR L'INTERFACE, la chaîne complète qui était impossible avant le
 * chantier du 13 septembre 2026, sur un jeu de données qui reproduit fidèlement la
 * situation de production (`scripts/seed_gold_demo.py`) :
 *
 *   1. le document est BLOQUÉ et l'interface NOMME le participant manquant ;
 *   2. le studio de configuration débloque en déclarant les participants réels ;
 *   3. la politique des secondaires est décidable (effet expliqué + impact chiffré)
 *      et s'APPLIQUE réellement aux documents déjà matérialisés ;
 *   4. l'atelier refuse la validation en 1 clic sur une ÉGALITÉ et l'explique ;
 *   5. l'arbitre décide un thème HORS des votes, avec un secondaire et une justification ;
 *   6. la décision est PERSISTÉE (relecture serveur) et le gold peut être figé.
 *
 * Pré-requis : `scripts/gold-demo-e2e.sh` (pile locale seedée sur :8002 / :3002).
 * Aucune donnée de production n'est touchée.
 */

const API = process.env.DEMO_API_URL ?? "http://localhost:8002/api/v1";
const SLUG = "demo-gold";
const DOC = "DemoToS";
const USER = "demo.lead";
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo-gold-e2e";
/** Captures de preuve : ce que l'arbitre voit réellement, étape par étape. */
const SHOTS = process.env.DEMO_SHOTS ?? "test-results/gold-demo";

/** Authentifie via l'API et injecte les jetons — on ne teste pas l'écran de connexion ici. */
async function signIn(page: Page) {
  const res = await page.request.post(`${API}/auth/login`, {
    data: { username: USER, password: PASSWORD },
  });
  expect(res.ok(), "connexion à la pile de démonstration").toBeTruthy();
  const { access, refresh } = await res.json();
  await page.addInitScript(
    ([a, r]) => {
      window.localStorage.setItem("claire.access", a as string);
      window.localStorage.setItem("claire.refresh", r as string);
    },
    [access, refresh],
  );
  return access as string;
}

test.describe("GOLD — démonstration de bout en bout (backend réel)", () => {
  test("du blocage au gold figé, entièrement par l'interface", async ({ page }) => {
    const access = await signIn(page);
    const auth = { Authorization: `Bearer ${access}` };

    // ── 1. Le document est bloqué, et l'interface DIT POURQUOI ────────────────
    await page.goto(`/projects/${SLUG}/gold/${DOC}`);
    await expect(page.getByTestId("gold-workspace")).toBeVisible();
    const awaiting = page.getByTestId("gold-awaiting-banner");
    await expect(awaiting).toBeVisible();
    // Le point décisif : le manquant est NOMMÉ (avant, un simple « 2/3 » indiagnosticable).
    await expect(page.getByTestId("gold-awaiting-missing")).toHaveText("demo.absent");
    await page.screenshot({ path: `${SHOTS}/1-blocage-diagnostique.png`, fullPage: true });
    // Tant que c'est bloqué, aucun contrôle d'arbitrage n'est offert.
    await expect(page.getByTestId("gold-auto-resolve")).toHaveCount(0);

    // ── 2. Déblocage par le studio : déclarer les participants réels ──────────
    await page.getByTestId("gold-awaiting-config-link").click();
    await expect(page.getByTestId("gold-config")).toBeVisible();

    const participant = page.getByTestId("participant-input");
    for (const username of ["demo.alice", "demo.bob", "demo.lead"]) {
      await participant.click();
      await participant.fill(username);
      await page.getByTestId(`participant-option-${username}`).click();
      await expect(page.getByTestId(`participant-chip-${username}`)).toBeVisible();
    }

    // ── 3. La politique des secondaires est DÉCIDABLE puis APPLIQUÉE ─────────
    // L'effet de l'option est écrit en toutes lettres (plus un menu de trois mots).
    await expect(page.getByTestId("config-secondary-effect")).toContainText(
      /n'entrent JAMAIS dans le gold auto-résolu/,
    );
    await page.getByTestId("config-secondary").selectOption("required");
    await expect(page.getByTestId("config-secondary-effect")).toContainText(
      /secondaires consensuels .* entrent dans le gold/,
    );

    await page.getByTestId("gold-config-save").click();
    await expect(page.getByTestId("gold-config-saved")).toBeVisible();

    // Enregistrer ne suffit pas : il faut APPLIQUER aux documents déjà matérialisés.
    await page.getByTestId("gold-recompute-all").click();
    await expect(page.getByTestId("gold-recompute-result")).toContainText(/document\(s\) recalculé/);
    await page.screenshot({ path: `${SHOTS}/2-studio-secondaires.png`, fullPage: true });

    // ── 4. L'atelier est débloqué ; l'égalité est signalée, pas validable d'un clic ──
    await page.goto(`/projects/${SLUG}/gold/${DOC}`);
    await expect(page.getByTestId("gold-awaiting-banner")).toHaveCount(0);
    await expect(page.getByTestId("gold-lock-mine")).toBeVisible(); // verrou auto-acquis

    // Le compteur annonce le travail réel (phrase 2 en égalité, phrase 3 solitaire).
    await expect(page.getByTestId("gold-todo-counter")).toContainText(/à trancher/);

    // La phrase 0 (accord strict) est auto-résolue ET porte désormais son secondaire,
    // preuve que la politique « requis » a bien été appliquée.
    const goldSentences = await page.request
      .get(`${API}/projects/${SLUG}/gold/${DOC}`, { headers: auth })
      .then((r) => r.json());
    const strict = goldSentences.sentences[0];
    expect(strict.decided, "accord strict auto-résolu").toBeTruthy();
    expect(strict.secondaries, "secondaires consensuels promus par « requis »").toEqual([
      "FEES_PAYMENT",
    ]);

    // ── 4-bis. Bascule de langue : le corpus est en anglais, l'arbitre lit en français ──
    const reading = page.getByTestId("gold-reading");
    await expect(reading).toContainText("We may terminate your account");
    await expect(page.getByTestId("gold-lang-switch")).toBeVisible();

    await page.getByTestId("gold-lang-both").click(); // bilingue : VO + FR
    await expect(page.getByTestId("gold-translation-0")).toContainText(
      "Nous pouvons résilier votre compte",
    );
    await expect(reading).toContainText("We may terminate your account");

    await page.getByTestId("gold-lang-fr").click(); // FR : la traduction remplace la VO
    await expect(reading).toContainText("Nous pouvons résilier votre compte");
    await expect(reading).not.toContainText("We may terminate your account");
    // Phrase 3 non traduite → repli sur la VO, signalé (jamais de trou dans le contrat).
    await expect(reading).toContainText("These terms are governed by the laws");
    await expect(reading).toContainText("non traduite");
    await page.screenshot({ path: `${SHOTS}/2b-lecture-en-francais.png`, fullPage: true });

    await page.getByTestId("gold-lang-orig").click(); // retour VO pour arbitrer sur le texte qui fait foi

    // La phrase 2 est l'ÉGALITÉ 1-1-1 : aucune validation en 1 clic n'est proposée.
    await page.getByTestId("gold-row-2").click();
    await expect(page.getByTestId("gold-inspector")).toContainText("Phrase 2");
    await expect(page.getByTestId("gold-tie-warning")).toContainText(/départage alphabétique/);
    await expect(page.getByTestId("gold-validate-2")).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/3-egalite-sans-consensus.png`, fullPage: true });

    // ── 5. Décider un thème HORS des votes, avec secondaire et justification ──
    // Les trois annotateurs ont proposé MODIFICATION_OF_TERMS / LIMITATION_LIABILITY /
    // PREAMBLE_SCOPE ; l'arbitre estime que la clause porte d'abord sur la résiliation.
    await expect(page.getByTestId("gold-decide-TERMINATION")).toHaveCount(0);
    const composer = page.getByTestId("gold-decision-composer");
    await expect(composer).toBeVisible(); // ouvert d'office sur une égalité
    await page.getByTestId("theme-option-TERMINATION").click();
    await page.getByTestId("theme-option-FEES_PAYMENT").click(); // secondaire
    await page.getByTestId("gold-comment-open").click();
    await page.getByTestId("gold-comment").fill("Clause de résiliation unilatérale (démo E2E).");
    await page.screenshot({ path: `${SHOTS}/4-decision-composee.png`, fullPage: true });
    await page.getByTestId("gold-decision-submit").click();

    // ── 6. La décision est PERSISTÉE côté serveur, avec tout son contenu ──────
    await expect
      .poll(async () => {
        const body = await page.request
          .get(`${API}/projects/${SLUG}/gold/${DOC}`, { headers: auth })
          .then((r) => r.json());
        return body.sentences[2];
      })
      .toMatchObject({
        decided: true,
        autoResolved: false,
        primary: "TERMINATION",
        secondaries: ["FEES_PAYMENT"],
        comment: "Clause de résiliation unilatérale (démo E2E).",
      });

    // La phrase 3 (couverte par un SEUL annotateur) n'a pas été auto-résolue : le
    // garde-fou de qualité tient, et elle reste dans la file de l'arbitre.
    const after = await page.request
      .get(`${API}/projects/${SLUG}/gold/${DOC}`, { headers: auth })
      .then((r) => r.json());
    expect(after.sentences[3].nCovering).toBe(1);
    expect(after.sentences[3].decided, "couverture solitaire jamais auto-résolue").toBeFalsy();

    // ── 7. Trancher la dernière phrase par la VOIE RAPIDE, puis figer le gold ──
    // Cette phrase n'est pas une égalité (un seul annotateur l'a couverte) : le composeur
    // reste replié et l'arbitre adopte le candidat en un clic — l'autre chemin de décision.
    await page.getByTestId("gold-row-3").click();
    await expect(page.getByTestId("gold-solitary")).toBeVisible();
    await page.getByTestId("gold-decide-MISC_BOILERPLATE").click();

    const finalize = page.getByTestId("gold-finalize");
    await expect(finalize).toBeVisible({ timeout: 10_000 });
    await finalize.click();
    // Acte irréversible → confirmation explicite (elle n'existait pas).
    await expect(page.getByTestId("gold-finalize-confirm")).toBeVisible();
    await page.getByTestId("gold-finalize-confirm-ok").click();

    await expect(page.getByTestId("gold-resolved-banner")).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${SHOTS}/5-gold-fige.png`, fullPage: true });

    // ── 8. Le gold est figé et l'audit complet ───────────────────────────────
    const final = await page.request
      .get(`${API}/projects/${SLUG}/gold/${DOC}`, { headers: auth })
      .then((r) => r.json());
    expect(final.finalized, "gold figé").toBeTruthy();
    expect(final.sentences.every((s: { decided: boolean }) => s.decided)).toBeTruthy();
  });
});
