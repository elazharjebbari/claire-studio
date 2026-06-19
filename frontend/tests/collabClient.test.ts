import { describe, expect, it } from "vitest";
import { createNoopCollab, createCollabClient } from "@/lib/collab/collabClient";

describe("collabClient (adaptateur temps réel)", () => {
  it("le repli no-op est inerte et non-live", async () => {
    const c = createNoopCollab();
    expect(c.isLive).toBe(false);
    await expect(c.connect()).resolves.toBeUndefined();
    // Les opérations ne jettent pas et la désinscription est une fonction.
    c.setFocus(3);
    c.broadcast({ opId: "op1", verb: "clause.retheme", payload: {} });
    const off = c.onPresence(() => {});
    expect(typeof off).toBe("function");
    off();
    c.disconnect();
  });

  it("createCollabClient retombe sur le repli si aucune URL WS n'est fournie", () => {
    const c = createCollabClient({ annotationId: "ann-1" });
    expect(c.isLive).toBe(false);
  });
});
