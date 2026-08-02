/**
 * Intégration du 4ᵉ juge LLM **Fable** côté frontend.
 *
 * Prouve que Fable traverse les surfaces N-modèles (réglette, comparaison, pré-remplissage)
 * sans cas particulier, qu'il est le modèle proposé par DÉFAUT, et — surtout — que la
 * nomenclature reste en PARITÉ avec le backend : `LLM_JUDGES` est confronté à
 * `Judge` (backend/claire/imports/models.py) et au type `Judge` de contract.ts. C'est ce
 * contrôle qui manquait quand `contract.ts` a raté Mistral.
 */

import { describe, expect, it, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { render, screen, cleanup } from "@testing-library/react";

import {
  LLM_JUDGES,
  LLM_JUDGE_IDS,
  DEFAULT_LLM_JUDGE,
  llmJudgeLabel,
  llmJudgeColor,
} from "@/lib/llmJudges";
import { UI_PREFS_DEFAULTS, mergeUiPrefs } from "@/lib/prefs/schema";
import { agreementSegments } from "@/components/workspace/ComparePanel";
import { ModelBoundaryLegend, type GutterModel } from "@/components/workspace/ModelBoundaryRail";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const read = (p: string) => readFileSync(resolve(REPO, p), "utf8");

afterEach(cleanup);

describe("Fable — nomenclature et parité backend", () => {
  it("Fable est le 4ᵉ juge, après Mistral", () => {
    expect(LLM_JUDGE_IDS).toEqual(["claude", "codex", "mistral", "fable"]);
    expect(llmJudgeLabel("fable")).toBe("Fable");
  });

  it("sa couleur d'identité est unique et n'est pas une couleur de THÈME", () => {
    const colors = LLM_JUDGES.map((j) => j.identityColor);
    expect(new Set(colors).size).toBe(colors.length);

    const themeColors: string[] = JSON.parse(read("frontend/design-tokens.json")).themes.map(
      (t: { color: string }) => t.color.toUpperCase(),
    );
    expect(themeColors).not.toContain(llmJudgeColor("fable").toUpperCase());
  });

  it("les initiales de piste restent distinctes (réglette lisible)", () => {
    const initials = LLM_JUDGES.map((j) => j.initial);
    expect(new Set(initials).size).toBe(initials.length);
  });

  it("PARITÉ : LLM_JUDGES == Judge.import_judges() du backend", () => {
    const models = read("backend/claire/imports/models.py");
    const block = models.slice(
      models.indexOf("class Judge(models.TextChoices)"),
      models.indexOf("class PreAnnotation"),
    );
    const backendIds = [...block.matchAll(/^\s{4}[A-Z_]+ = "([a-z0-9_-]+)"/gm)].map((m) => m[1]!);
    expect(backendIds).toEqual([...LLM_JUDGE_IDS, "other"]); // `other` = fourre-tout, pas une piste
  });

  it("PARITÉ : le type Judge de contract.ts couvre tous les juges backend", () => {
    const contract = read("frontend/src/types/contract.ts");
    const decl = /export type Judge =([^;]+);/.exec(contract)?.[1] ?? "";
    const declared = new Set([...decl.matchAll(/"([^"]+)"/g)].map((m) => m[1]!));
    for (const id of LLM_JUDGE_IDS) expect(declared).toContain(id);
    expect(declared).toContain("other");
  });
});

describe("Fable — modèle proposé par défaut", () => {
  it("DEFAULT_LLM_JUDGE vaut fable et désigne un juge existant", () => {
    expect(DEFAULT_LLM_JUDGE).toBe("fable");
    expect(LLM_JUDGE_IDS).toContain(DEFAULT_LLM_JUDGE);
  });

  it("un compte neuf a Fable armé, mais l'auto-exécution reste opt-in", () => {
    expect(UI_PREFS_DEFAULTS.prefill.judge).toBe("fable");
    expect(UI_PREFS_DEFAULTS.prefill.enabled).toBe(false);
    expect(UI_PREFS_DEFAULTS.prefill.asked).toBe(false);
  });

  it("PARITÉ : même défaut côté serveur (accounts/ui_prefs.py)", () => {
    const py = read("backend/claire/accounts/ui_prefs.py");
    expect(/DEFAULT_PREFILL_JUDGE\s*=\s*"([^"]+)"/.exec(py)?.[1]).toBe(DEFAULT_LLM_JUDGE);
  });

  it("un choix déjà exprimé n'est jamais écrasé par le défaut", () => {
    const merged = mergeUiPrefs(UI_PREFS_DEFAULTS, {
      prefill: { enabled: true, judge: "claude", asked: true },
    });
    expect(merged.prefill.judge).toBe("claude");
  });
});

describe("Fable — surfaces N-modèles à 4 juges", () => {
  it("comparaison N-way : 4 juges d'accord → un seul segment 'agree'", () => {
    const segs = agreementSegments(
      [
        ["A", "A", "A"],
        ["A", "A", "A"],
        ["A", "A", "A"],
        ["A", "A", "A"],
      ],
      4,
      3,
    );
    expect(segs).toEqual([{ start: 0, end: 2, status: "agree" }]);
  });

  it("comparaison N-way : Fable seul divergent → 'diverge' sur cette phrase", () => {
    const segs = agreementSegments(
      [
        ["A", "A"],
        ["A", "A"],
        ["A", "A"],
        ["A", "B"], // fable
      ],
      4,
      2,
    );
    expect(segs[0]).toEqual({ start: 0, end: 0, status: "agree" });
    expect(segs[1]).toEqual({ start: 1, end: 1, status: "diverge" });
  });

  it("réglette : les 4 pistes sont rendues, celle sans données est désactivée", () => {
    const models: GutterModel[] = LLM_JUDGES.map((j) => ({
      id: j.id,
      label: j.label,
      initial: j.initial,
      identityColor: j.identityColor,
      hasData: j.id !== "mistral", // Mistral ne couvre pas tout le corpus
      segments: [],
    }));
    render(<ModelBoundaryLegend models={models} />);
    for (const j of LLM_JUDGES) expect(screen.getByTestId(`gutter-toggle-${j.id}`)).toBeTruthy();
    expect((screen.getByTestId("gutter-toggle-fable") as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId("gutter-toggle-mistral") as HTMLButtonElement).disabled).toBe(true);
  });
});
