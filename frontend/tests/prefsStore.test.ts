import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usePrefsStore } from "@/store/prefs";
import { UI_PREFS_DEFAULTS } from "@/lib/prefs/schema";

beforeEach(() => {
  window.localStorage.clear();
  usePrefsStore.setState({ uid: null, prefs: UI_PREFS_DEFAULTS, rev: 0, syncStatus: "idle" });
});
afterEach(() => window.localStorage.clear());

describe("usePrefsStore", () => {
  it("démarre sur les défauts", () => {
    expect(usePrefsStore.getState().prefs).toEqual(UI_PREFS_DEFAULTS);
  });

  it("setPanel mute + incrémente rev + écrit le cache namespacé", () => {
    const s = usePrefsStore.getState();
    s.bindUser("u1");
    const rev0 = usePrefsStore.getState().rev;
    usePrefsStore.getState().setPanel("inspectorOpen", false);
    expect(usePrefsStore.getState().prefs.panels.inspectorOpen).toBe(false);
    expect(usePrefsStore.getState().rev).toBe(rev0 + 1);
    expect(window.localStorage.getItem("claire.prefs::u1")).toContain("inspectorOpen");
  });

  it("est IDEMPOTENT : régler la même valeur ne bump pas rev (pas d'écho PATCH)", () => {
    usePrefsStore.getState().bindUser("u1");
    usePrefsStore.getState().setPanel("inspectorOpen", false);
    const rev1 = usePrefsStore.getState().rev;
    usePrefsStore.getState().setPanel("inspectorOpen", false); // identique
    expect(usePrefsStore.getState().rev).toBe(rev1);
  });

  it("setPrefill / setOverlays / setGhostJudge fusionnent par section", () => {
    usePrefsStore.getState().bindUser("u1");
    usePrefsStore.getState().setPrefill({ enabled: true, judge: "mistral" });
    usePrefsStore.getState().setOverlays({ showUnfairness: false });
    usePrefsStore.getState().setGhostJudge("claude", true);
    const p = usePrefsStore.getState().prefs;
    expect(p.prefill).toEqual({ enabled: true, judge: "mistral", asked: false });
    expect(p.overlays.showUnfairness).toBe(false);
    expect(p.overlays.displayLang).toBe("orig"); // intact
    expect(p.ghostJudges).toEqual({ claude: true });
  });

  it("applyServer applique les prefs serveur SANS bump rev (pull autoritaire)", () => {
    usePrefsStore.getState().bindUser("u1");
    const rev0 = usePrefsStore.getState().rev;
    usePrefsStore.getState().applyServer({ overlays: { displayLang: "fr" }, prefill: { enabled: true, judge: "codex" } });
    expect(usePrefsStore.getState().prefs.overlays.displayLang).toBe("fr");
    expect(usePrefsStore.getState().prefs.prefill.judge).toBe("codex");
    expect(usePrefsStore.getState().rev).toBe(rev0); // pas d'écho
  });

  it("namespace par uid : aucune fuite inter-comptes", () => {
    usePrefsStore.getState().bindUser("u1");
    usePrefsStore.getState().setOverlays({ showUnfairness: false });
    // Bascule sur un AUTRE compte → défauts (cache distinct).
    usePrefsStore.getState().bindUser("u2");
    expect(usePrefsStore.getState().prefs.overlays.showUnfairness).toBe(true);
    // Retour sur u1 → restauré depuis son cache.
    usePrefsStore.getState().bindUser("u1");
    expect(usePrefsStore.getState().prefs.overlays.showUnfairness).toBe(false);
  });

  it("reset rétablit les défauts", () => {
    usePrefsStore.getState().bindUser("u1");
    usePrefsStore.getState().setPrefill({ enabled: true, judge: "mistral" });
    usePrefsStore.getState().reset();
    expect(usePrefsStore.getState().prefs).toEqual(UI_PREFS_DEFAULTS);
  });
});
