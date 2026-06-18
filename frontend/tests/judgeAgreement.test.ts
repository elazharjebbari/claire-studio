import { describe, expect, it } from "vitest";
import { judgeThemeAt } from "@/lib/runs";

type Ghost = { anchorIndex: number; theme: string; judge: string };

const ghosts: Ghost[] = [
  { anchorIndex: 0, theme: "META", judge: "claude" },
  { anchorIndex: 4, theme: "TERMINATION", judge: "claude" },
  { anchorIndex: 0, theme: "META", judge: "codex" },
  { anchorIndex: 4, theme: "ARBITRATION_DISPUTES", judge: "codex" },
];

describe("judgeThemeAt", () => {
  it("renvoie le thème proposé par chaque juge pour une phrase via ses runs", () => {
    expect(judgeThemeAt(ghosts, "claude", 2, 8)).toBe("META");
    expect(judgeThemeAt(ghosts, "claude", 5, 8)).toBe("TERMINATION");
    expect(judgeThemeAt(ghosts, "codex", 5, 8)).toBe("ARBITRATION_DISPUTES");
  });

  it("renvoie null si le juge n'a aucune proposition", () => {
    expect(judgeThemeAt(ghosts, "gemini", 2, 8)).toBeNull();
    expect(judgeThemeAt([], "claude", 0, 8)).toBeNull();
  });

  it("permet de détecter l'accord / désaccord entre juges", () => {
    // Phrase 1 : les deux juges sont dans leur run META → accord.
    const c1 = judgeThemeAt(ghosts, "claude", 1, 8);
    const x1 = judgeThemeAt(ghosts, "codex", 1, 8);
    expect(c1 === x1).toBe(true);

    // Phrase 5 : Claude=TERMINATION, Codex=ARBITRATION → désaccord.
    const c5 = judgeThemeAt(ghosts, "claude", 5, 8);
    const x5 = judgeThemeAt(ghosts, "codex", 5, 8);
    expect(c5 === x5).toBe(false);
    expect(c5).toBe("TERMINATION");
    expect(x5).toBe("ARBITRATION_DISPUTES");
  });
});
