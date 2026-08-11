/**
 * `createRun` — verrou du correctif trouvé en pilotant l'app dans un vrai navigateur.
 *
 * Le corps envoyé fixait `metricCodes` sur les 7 codes historiques : deux commits
 * entiers ont ajouté 8 métriques côté backend (`DEFAULT_METRICS`) sans que ce fichier
 * ne change, donc AUCUN run réel ne les demandait jamais — masqué par des tests
 * vitest dont les fixtures construisaient `AnalysisResult` à la main, en cour-circuitant
 * la création de run. Seul un vrai run, dans un vrai navigateur, l'a révélé.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { createRun } from "@/features/analysis/api";
import * as client from "@/lib/api/client";

afterEach(() => vi.restoreAllMocks());

describe("createRun", () => {
  it("n'envoie PAS de metricCodes : le serveur reste la seule source de vérité", async () => {
    const spy = vi.spyOn(client, "apiFetch").mockResolvedValue({ id: "run-1" } as never);

    await createRun("demo", "snapshot-1");

    expect(spy).toHaveBeenCalledWith(
      "/projects/demo/analysis/runs",
      expect.objectContaining({ method: "POST", body: { snapshotId: "snapshot-1" } }),
    );
    const [, options] = spy.mock.calls[0]!;
    expect((options as { body: Record<string, unknown> }).body).not.toHaveProperty("metricCodes");
  });
});
