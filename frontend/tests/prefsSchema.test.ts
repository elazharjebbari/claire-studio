import { describe, expect, it } from "vitest";
import {
  UI_PREFS_DEFAULTS,
  UI_PREFS_SCHEMA_VERSION,
  mergeUiPrefs,
  migratePrefs,
} from "@/lib/prefs/schema";

describe("mergeUiPrefs (fusion aux défauts, whitelist, bornage)", () => {
  it("prefs vides → défauts exacts (comportement actuel préservé)", () => {
    expect(migratePrefs(undefined)).toEqual(UI_PREFS_DEFAULTS);
    expect(migratePrefs(null)).toEqual(UI_PREFS_DEFAULTS);
    expect(migratePrefs({})).toEqual(UI_PREFS_DEFAULTS);
  });

  it("fusionne partiellement et complète les champs absents", () => {
    const r = mergeUiPrefs(UI_PREFS_DEFAULTS, {
      overlays: { showUnfairness: false },
      prefill: { enabled: true, judge: "mistral" },
    });
    expect(r.overlays.showUnfairness).toBe(false);
    expect(r.overlays.displayLang).toBe("orig"); // absent → défaut
    expect(r.prefill).toEqual({ enabled: true, judge: "mistral", asked: false });
    expect(r.panels.inspectorOpen).toBe(true); // défaut
  });

  it("IGNORE les champs inconnus (whitelist implicite)", () => {
    const r = mergeUiPrefs(UI_PREFS_DEFAULTS, {
      overlays: { showUnfairness: false, hacker: "x" },
      bogus: { a: 1 },
    } as unknown);
    expect(r.overlays.showUnfairness).toBe(false);
    expect((r as unknown as Record<string, unknown>).bogus).toBeUndefined();
    expect((r.overlays as unknown as Record<string, unknown>).hacker).toBeUndefined();
  });

  it("borne displayLang à une valeur autorisée", () => {
    expect(mergeUiPrefs(UI_PREFS_DEFAULTS, { overlays: { displayLang: "klingon" } }).overlays.displayLang).toBe("orig");
    expect(mergeUiPrefs(UI_PREFS_DEFAULTS, { overlays: { displayLang: "fr" } }).overlays.displayLang).toBe("fr");
  });

  it("garde les ids de juge LIBRES (llmSource, prefill.judge, ghostJudges)", () => {
    const r = mergeUiPrefs(UI_PREFS_DEFAULTS, {
      overlays: { llmSource: "un-futur-modele" },
      prefill: { judge: "gpt-5" },
      ghostJudges: { claude: true, mistral: false, futur: true },
    });
    expect(r.overlays.llmSource).toBe("un-futur-modele");
    expect(r.prefill.judge).toBe("gpt-5");
    expect(r.ghostJudges).toEqual({ claude: true, mistral: false, futur: true });
  });

  it("ghostJudges : ignore les valeurs non booléennes", () => {
    const r = mergeUiPrefs(UI_PREFS_DEFAULTS, { ghostJudges: { claude: true, x: "nope", y: 1 } } as unknown);
    expect(r.ghostJudges).toEqual({ claude: true });
  });

  it("prefill.judge = null explicite est respecté", () => {
    expect(mergeUiPrefs(UI_PREFS_DEFAULTS, { prefill: { judge: null } }).prefill.judge).toBeNull();
  });

  it("force toujours la version courante", () => {
    expect(mergeUiPrefs(UI_PREFS_DEFAULTS, { v: 0 }).v).toBe(UI_PREFS_SCHEMA_VERSION);
    expect(migratePrefs({ v: 99 }).v).toBe(UI_PREFS_SCHEMA_VERSION);
  });

  it("ne mute pas les défauts partagés", () => {
    const r = mergeUiPrefs(UI_PREFS_DEFAULTS, { ghostJudges: { claude: true } });
    r.ghostJudges.claude = false;
    expect(UI_PREFS_DEFAULTS.ghostJudges).toEqual({});
  });
});
