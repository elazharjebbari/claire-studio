/**
 * UI du Lab — logique pure du panneau de préparation et rendu des états.
 *
 * Le point le plus sensible testé ici : le mot de passe Grid'5000 ne doit jamais être
 * réaffiché, même quand un secret existe côté serveur.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  buildLines,
  hrefFor,
  isArticleBlocked,
  levelFor,
  recoverableWork,
  sortBlockers,
} from "@/features/lab/readiness";
import { ReadinessPanel } from "@/features/lab/ReadinessPanel";
import type { CampaignReadiness } from "@/features/lab/types";

afterEach(cleanup);

const readiness: CampaignReadiness = {
  documentsTotal: 50,
  documentsAnnotated: 36,
  documentsMultiAnnotatedSubmitted: 4,
  documentsMultiAnnotatedComplete: 7,
  documentsTripleAnnotated: 3,
  documentsWithGold: 0,
  completeButNotSubmitted: [
    { documentId: 1, actorKey: "human:3", validated: 193, nSentences: 193 },
    { documentId: 2, actorKey: "human:3", validated: 139, nSentences: 139 },
  ],
  targets: { multiAnnotated: 12, tripleAnnotated: 5, goldFinalized: 3 },
  blockers: [
    { code: "no_gold_finalized", message: "aucune résolution gold décidée", severity: "medium" },
    {
      code: "complete_but_not_submitted",
      message: "2 annotation(s) terminée(s) mais non soumise(s)",
      severity: "high",
    },
  ],
};

// --------------------------------------------------------------------------- //
// Logique pure
// --------------------------------------------------------------------------- //

describe("levelFor", () => {
  it("cible atteinte → ok", () => {
    expect(levelFor(12, 12)).toBe("ok");
    expect(levelFor(15, 12)).toBe("ok");
  });

  it("au-dessus de la moitié → en approche", () => {
    expect(levelFor(7, 12)).toBe("warn");
  });

  it("sous la moitié → bloquant (ce n'est plus un ajustement)", () => {
    expect(levelFor(3, 12)).toBe("blocked");
  });

  it("sans cible → toujours ok", () => {
    expect(levelFor(0, null)).toBe("ok");
  });
});

describe("buildLines", () => {
  it("produit une ligne par verrou, avec sa cible", () => {
    const lines = buildLines(readiness);
    expect(lines.map((l) => l.key)).toEqual(["annotated", "multi", "triple", "gold"]);
    expect(lines.find((l) => l.key === "multi")?.target).toBe(12);
  });

  it("le gold à zéro est bloquant", () => {
    expect(buildLines(readiness).find((l) => l.key === "gold")?.level).toBe("blocked");
  });

  it("readiness absent → aucune ligne (pas de zéros trompeurs)", () => {
    expect(buildLines(null)).toEqual([]);
  });
});

describe("recoverableWork", () => {
  it("chiffre le gain récupérable sans annoter davantage", () => {
    const result = recoverableWork(readiness);
    expect(result.count).toBe(2);
    expect(result.sentences).toBe(332);
    expect(result.annotators).toEqual(["human:3"]);
  });

  it("rien à récupérer → zéro", () => {
    expect(recoverableWork(null).count).toBe(0);
  });
});

describe("sortBlockers", () => {
  it("les sévérités hautes passent devant : c'est l'ordre d'action", () => {
    expect(sortBlockers(readiness.blockers)[0]!.severity).toBe("high");
  });
});

describe("isArticleBlocked", () => {
  it("un verrou scientifique bloquant suffit", () => {
    expect(isArticleBlocked(buildLines(readiness))).toBe(true);
  });

  it("l'avancement de l'annotation seul ne bloque pas l'article", () => {
    // Une campagne inachevée mais bien redondante permet déjà d'écrire.
    const lines = buildLines({
      ...readiness,
      documentsAnnotated: 2,
      documentsMultiAnnotatedComplete: 12,
      documentsTripleAnnotated: 5,
      documentsWithGold: 3,
    });
    expect(isArticleBlocked(lines)).toBe(false);
  });
});

// --------------------------------------------------------------------------- //
// Rendu
// --------------------------------------------------------------------------- //

describe("ReadinessPanel", () => {
  it("met en avant le travail récupérable", () => {
    render(<ReadinessPanel readiness={readiness} />);
    const banner = screen.getByTestId("readiness-recoverable");
    expect(banner.textContent).toContain("2 annotations terminée");
    expect(banner.textContent).toContain("332 phrases");
    expect(banner.textContent).toMatch(/aucune annotation supplémentaire/i);
  });

  it("affiche le verdict et les bloquants ordonnés", () => {
    render(<ReadinessPanel readiness={readiness} />);
    expect(screen.getByTestId("readiness-verdict").textContent).toBe("matériau insuffisant");
    const blockers = screen.getByTestId("readiness-blockers");
    expect(blockers.textContent).toContain("non soumise");
  });

  it("chaque ligne expose une barre de progression accessible", () => {
    render(<ReadinessPanel readiness={readiness} />);
    const bars = screen.getAllByRole("progressbar");
    expect(bars.length).toBe(4);
    expect(bars[1]).toHaveAttribute("aria-valuemax", "12");
  });

  it("sans instantané, dit quoi faire", () => {
    render(<ReadinessPanel readiness={null} />);
    expect(screen.getByTestId("readiness-empty").textContent).toMatch(/créez-en un/i);
  });

  it("⭐ chaque ligne rouge ou orange est cliquable et mène à la liste des objets concernés — pas juste du texte, comme le promettait le docstring depuis le début", () => {
    render(<ReadinessPanel readiness={readiness} slug="demo" />);
    expect(screen.getByTestId("readiness-line-link-multi")).toHaveAttribute(
      "href",
      "/projects/demo/lab?tab=datasets&minAnnotators=2",
    );
    expect(screen.getByTestId("readiness-line-link-gold")).toHaveAttribute(
      "href", "/projects/demo/gold",
    );
  });

  it("sans slug (contexte de test, page hors routage projet), les lignes restent du texte simple", () => {
    render(<ReadinessPanel readiness={readiness} />);
    expect(screen.queryByTestId("readiness-line-link-multi")).not.toBeInTheDocument();
    expect(screen.getByTestId("readiness-line-multi")).toBeInTheDocument();
  });
});

describe("hrefFor", () => {
  it("multi/triple mènent au Lab avec le seuil pré-rempli", () => {
    expect(hrefFor("multi", "demo")).toBe("/projects/demo/lab?tab=datasets&minAnnotators=2");
    expect(hrefFor("triple", "demo")).toBe("/projects/demo/lab?tab=datasets&minAnnotators=3");
  });

  it("gold mène au cockpit GOLD, annotated à la liste des documents", () => {
    expect(hrefFor("gold", "demo")).toBe("/projects/demo/gold");
    expect(hrefFor("annotated", "demo")).toBe("/projects/demo/docs");
  });

  it("une clé inconnue ne mène nulle part plutôt qu'un lien cassé", () => {
    expect(hrefFor("n-existe-pas", "demo")).toBeNull();
  });
});

// --------------------------------------------------------------------------- //
// Sécurité de l'écran des identifiants
// --------------------------------------------------------------------------- //

vi.mock("@/features/lab/api", () => ({
  getCredentials: vi.fn().mockResolvedValue({
    configured: true,
    credentials: [
      {
        id: 1,
        kind: "g5k",
        login: "ajebbari",
        hasPassword: true,
        lastTestedAt: null,
        lastTestOk: null,
        lastTestDetail: "",
      },
    ],
  }),
  saveCredential: vi.fn(),
  testCredential: vi.fn(),
  deleteCredential: vi.fn(),
  listDatasets: vi.fn().mockResolvedValue([]),
  listRuns: vi.fn().mockResolvedValue([]),
  cancelRun: vi.fn(),
  preflight: vi.fn(),
  buildDataset: vi.fn(),
  compareRuns: vi.fn(),
  getRun: vi.fn(),
}));

describe("ComputeSettings", () => {
  it("le champ mot de passe reste VIDE même quand un secret existe", async () => {
    const { ComputeSettings } = await import("@/features/lab/ComputeSettings");
    render(<ComputeSettings />);
    const field = await screen.findByTestId("g5k-password");
    // Un secret enregistré se signale par un placeholder, jamais par une valeur.
    expect((field as HTMLInputElement).value).toBe("");
  });

  it("le bouton de test dit pourquoi il est désactivé quand rien n'est enregistré", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getCredentials).mockResolvedValueOnce({
      configured: true,
      credentials: [],
    });
    const { ComputeSettings } = await import("@/features/lab/ComputeSettings");
    render(<ComputeSettings />);
    const button = await screen.findByTestId("g5k-test");
    expect(button).toBeDisabled();
    expect(button.getAttribute("title")).toMatch(/aucun identifiant enregistré/i);
  });

  it("serveur sans clé de chiffrement : fonction désactivée AVEC son motif", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getCredentials).mockResolvedValueOnce({
      configured: false,
      credentials: [],
    });
    const { ComputeSettings } = await import("@/features/lab/ComputeSettings");
    render(<ComputeSettings />);
    const notice = await screen.findByTestId("compute-not-configured");
    expect(notice.textContent).toMatch(/LAB_CREDENTIALS_KEY/);
    // Et le repli est annoncé : l'exécution locale reste disponible.
    expect(notice.textContent).toMatch(/locale/i);
  });

  it("⭐ un identifiant déjà enregistré permet d'ajouter la clé SSH SANS retaper le mot de passe", async () => {
    // Bug réel trouvé en prod (11 août 2026) : le bouton restait désactivé tant que le
    // champ mot de passe était vide, même quand un identifiant existait déjà — rendant
    // impossible d'ajouter/modifier SEULEMENT la clé SSH.
    const api = await import("@/features/lab/api");
    vi.mocked(api.saveCredential).mockResolvedValue({
      id: 1, kind: "g5k", login: "ajebbari", hasPassword: true, hasSshKey: true,
      lastTestedAt: null, lastTestOk: null, lastTestSshOk: null, lastTestDetail: "",
    } as never);
    const { ComputeSettings } = await import("@/features/lab/ComputeSettings");
    const user = userEvent.setup();
    render(<ComputeSettings />);

    const button = await screen.findByTestId("g5k-save");
    expect(button).not.toBeDisabled(); // mot de passe déjà enregistré (hasPassword: true)

    await user.type(screen.getByTestId("g5k-ssh-key"), "-----BEGIN OPENSSH PRIVATE KEY-----");
    await user.click(button);

    expect(api.saveCredential).toHaveBeenCalledWith(
      expect.objectContaining({ password: undefined, sshKey: "-----BEGIN OPENSSH PRIVATE KEY-----" }),
    );
  });

  it("un premier enregistrement (rien d'existant) exige toujours un mot de passe", async () => {
    const api = await import("@/features/lab/api");
    vi.mocked(api.getCredentials).mockResolvedValueOnce({
      configured: true,
      credentials: [],
    });
    const { ComputeSettings } = await import("@/features/lab/ComputeSettings");
    const user = userEvent.setup();
    render(<ComputeSettings />);

    await user.type(await screen.findByTestId("g5k-login"), "ajebbari");
    const button = screen.getByTestId("g5k-save");
    expect(button).toBeDisabled();
    expect(button.getAttribute("title")).toMatch(/mot de passe requis/i);
  });
});
