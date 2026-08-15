/**
 * Fonctions pures du suivi des exécutions (audit UI/UX, 15 août 2026) :
 * `elapsedLabel`, `isProgressLive`, `isStaleHeartbeat`.
 */

import { describe, expect, it } from "vitest";

import {
  elapsedLabel,
  isProgressLive,
  isStaleHeartbeat,
  STALE_HEARTBEAT_MS,
} from "@/features/lab/runStatus";

describe("elapsedLabel", () => {
  const now = Date.parse("2026-08-15T10:00:00Z");

  it("secondes seules sous la minute", () => {
    expect(elapsedLabel("2026-08-15T09:59:48Z", now)).toBe("12 s");
  });

  it("minutes + secondes sous l'heure", () => {
    expect(elapsedLabel("2026-08-15T09:56:40Z", now)).toBe("3 min 20 s");
  });

  it("heures + minutes au-delà de l'heure", () => {
    expect(elapsedLabel("2026-08-15T08:04:00Z", now)).toBe("1 h 56");
  });

  it("null/undefined/date invalide → null (jamais un texte trompeur)", () => {
    expect(elapsedLabel(null, now)).toBeNull();
    expect(elapsedLabel(undefined, now)).toBeNull();
    expect(elapsedLabel("pas-une-date", now)).toBeNull();
  });

  it("horodatage futur (horloge client en avance) → 0 s, jamais négatif", () => {
    expect(elapsedLabel("2026-08-15T10:05:00Z", now)).toBe("0 s");
  });
});

describe("isProgressLive", () => {
  it("un run local est toujours considéré vivant, même à 0%", () => {
    expect(isProgressLive("local", 0)).toBe(true);
    expect(isProgressLive(undefined, 0)).toBe(true);
  });

  it("un run Grid'5000 à 0% n'est PAS vivant — progress ne bouge qu'à l'ingestion", () => {
    expect(isProgressLive("g5k", 0)).toBe(false);
  });

  it("un run Grid'5000 avec un progress > 0 redevient vivant", () => {
    expect(isProgressLive("g5k", 40)).toBe(true);
  });
});

describe("isStaleHeartbeat", () => {
  const now = Date.parse("2026-08-15T10:00:00Z");

  it("aucun battement → jamais périmé (rien à comparer, pas encore pris en charge)", () => {
    expect(isStaleHeartbeat(null, now)).toBe(false);
  });

  it("battement récent → pas périmé", () => {
    expect(isStaleHeartbeat("2026-08-15T09:58:00Z", now)).toBe(false);
  });

  it("battement plus vieux que le seuil (aligné sur HEARTBEAT_TIMEOUT serveur, 20 min) → périmé", () => {
    const old = new Date(now - STALE_HEARTBEAT_MS - 1000).toISOString();
    expect(isStaleHeartbeat(old, now)).toBe(true);
  });

  it("exactement au seuil → pas encore périmé (strictement supérieur)", () => {
    const boundary = new Date(now - STALE_HEARTBEAT_MS).toISOString();
    expect(isStaleHeartbeat(boundary, now)).toBe(false);
  });
});
