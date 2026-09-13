/**
 * Vue « Résultats pour l'article » — les garanties qui la rendent citable.
 *
 * Ce qui est testé n'est pas l'esthétique mais les PROMESSES : le statut est déduit des
 * contrôles et non déclaré, ce qui bloque est nommé, le mode « prêt pour l'article » ne
 * laisse passer que les résultats validés, et tout chiffre exporté porte sa provenance.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { PaperResults } from "@/features/paper/PaperResults";
import campaign from "@/features/paper/campaign.json";
import {
  escapeLatex,
  experimentToLatex,
  inlineValuesToLatex,
  metricsToCsv,
  rqToLatex,
} from "@/features/paper/export";
import { isPaperReady, type Campaign, type PaperExperiment } from "@/features/paper/types";

const data = campaign as unknown as Campaign;

afterEach(() => cleanup());

describe("Campagne (données)", () => {
  it("⭐ chaque expérience porte une provenance COMPLÈTE", () => {
    for (const e of data.experiments) {
      expect(e.data.datasetFingerprint, e.id).toBeTruthy();
      expect(e.provenance.codeVersion, e.id).toBeTruthy();
      expect(e.provenance.executedAt, e.id).toBeTruthy();
      expect(e.provenance.taxonomySpecFingerprint, e.id).toBeTruthy();
      expect(e.config, e.id).toBeTruthy();
    }
  });

  it("⭐ le statut est COHÉRENT avec les contrôles (déduit, jamais déclaré)", () => {
    for (const e of data.experiments) {
      const blocking = e.gates.filter((g) => g.blocking && !g.passed);
      if (blocking.length === 0) {
        expect(["validated", "final"], e.id).toContain(e.status);
      } else {
        expect(["preliminary", "stale", "draft"], e.id).toContain(e.status);
      }
    }
  });

  it("toute expérience déclare question, hypothèse, protocole et interprétation", () => {
    for (const e of data.experiments) {
      for (const field of ["question", "hypothesis", "protocol", "interpretation"] as const) {
        expect(e[field].length, `${e.id}.${field}`).toBeGreaterThan(40);
      }
    }
  });

  it("couvre les quatre questions de recherche", () => {
    expect([...new Set(data.experiments.map((e) => e.rq))].sort()).toEqual([
      "RQ1", "RQ2", "RQ3", "RQ4",
    ]);
  });
});

describe("PaperResults (vue)", () => {
  it("affiche la campagne, son dataset et le décompte des résultats citables", () => {
    render(<PaperResults />);
    expect(screen.getByTestId("paper-results")).toBeInTheDocument();
    const ready = data.experiments.filter(isPaperReady).length;
    expect(screen.getByTestId("paper-ready-count")).toHaveTextContent(String(ready));
  });

  it("⭐ NOMME ce qui bloque les résultats non citables", () => {
    const blocked = data.experiments.filter((e) => !isPaperReady(e));
    render(<PaperResults />);
    if (blocked.length === 0) {
      expect(screen.queryByTestId("paper-blockers")).not.toBeInTheDocument();
      return;
    }
    const banner = screen.getByTestId("paper-blockers");
    const gateIds = new Set(
      blocked.flatMap((e) => e.gates.filter((g) => g.blocking && !g.passed).map((g) => g.id)),
    );
    for (const id of gateIds) {
      expect(within(banner).getByTestId(`paper-blocker-${id}`)).toBeInTheDocument();
    }
  });

  it("navigue par question de recherche", () => {
    render(<PaperResults />);
    fireEvent.click(screen.getByTestId("paper-rq-RQ4"));
    const rq4 = data.experiments.filter((e) => e.rq === "RQ4");
    for (const e of rq4) {
      expect(screen.getByTestId(`paper-exp-${e.id}`)).toBeInTheDocument();
    }
    // Les expériences des autres questions ne sont plus affichées.
    const rq1 = data.experiments.find((e) => e.rq === "RQ1")!;
    expect(screen.queryByTestId(`paper-exp-${rq1.id}`)).not.toBeInTheDocument();
  });

  it("⭐ le mode « prêt pour l'article » masque tout ce qui n'est pas citable", () => {
    render(<PaperResults />);
    const notReady = data.experiments.find((e) => e.rq === "RQ1" && !isPaperReady(e));
    if (notReady) {
      expect(screen.getByTestId(`paper-exp-${notReady.id}`)).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("paper-ready-toggle"));
      expect(screen.queryByTestId(`paper-exp-${notReady.id}`)).not.toBeInTheDocument();
    }
  });

  it("déplie le détail : protocole, contrôles et provenance", () => {
    render(<PaperResults />);
    const first = data.experiments.find((e) => e.rq === "RQ1")!;
    fireEvent.click(screen.getByTestId(`paper-toggle-${first.id}`));
    const detail = screen.getByTestId("paper-detail");
    expect(detail).toHaveTextContent(first.question.slice(0, 40));
    expect(screen.getByTestId(`paper-provenance-${first.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`paper-gates-detail-${first.id}`)).toBeInTheDocument();
  });
});

describe("Export", () => {
  const sample = data.experiments.slice(0, 3) as PaperExperiment[];

  it("⭐ le CSV porte la provenance de CHAQUE chiffre", () => {
    const csv = metricsToCsv(sample);
    const [header, ...rows] = csv.split("\n");
    for (const column of ["dataset_fingerprint", "code_version", "executed_at", "status"]) {
      expect(header).toContain(column);
    }
    expect(rows.length).toBe(sample.reduce((n, e) => n + e.metrics.length, 0));
  });

  it("le LaTeX d'une expérience cite son identifiant, son statut et son dataset", () => {
    const tex = experimentToLatex(sample[0]!);
    expect(tex).toContain(sample[0]!.id);
    expect(tex).toContain(sample[0]!.status);
    expect(tex).toContain("\\begin{table}");
    expect(tex).toContain("\\label{tab:");
  });

  it("échappe les caractères actifs de LaTeX", () => {
    expect(escapeLatex("Frais & paiement 95 % _test_")).toBe(
      "Frais \\& paiement 95 \\% \\_test\\_",
    );
  });

  it("produit des valeurs citables en ligne, une macro par métrique numérique", () => {
    const tex = inlineValuesToLatex(sample);
    const expected = sample.reduce(
      (n, e) => n + e.metrics.filter((m) => typeof m.value === "number").length,
      0,
    );
    expect(tex.split("\\newcommand").length - 1).toBe(expected);
  });

  it("le tableau de synthèse d'une question liste ses expériences et leurs statuts", () => {
    const tex = rqToLatex("RQ1", "Fiabilité", sample);
    for (const e of sample) {
      expect(tex).toContain(e.id);
      expect(tex).toContain(`${e.id}=${e.status}`);
    }
  });
});
