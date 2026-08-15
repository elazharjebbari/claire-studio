/**
 * Vocabulaire partagé des statuts de run — extrait de `RunList.tsx` pour être réutilisé
 * tel quel par `RunResults.tsx` et `ActiveRunIndicator.tsx` (audit UI/UX du suivi des
 * exécutions, 15 août 2026) : un statut ne doit jamais se colorer ou s'étiqueter
 * différemment selon l'écran où il apparaît.
 */

import { Ban, Clock, Loader2, TriangleAlert, XCircle, CheckCircle2, CircleDashed } from "lucide-react";

import type { RunStatus } from "./types";

export const RESULTS_READY: RunStatus[] = ["succeeded", "partial", "failed"];
export const COMPARABLE_STATUSES: RunStatus[] = ["succeeded", "partial"];
export const ACTIVE: RunStatus[] = ["queued", "waiting", "running"];
export const TERMINAL: RunStatus[] = ["succeeded", "partial", "failed", "cancelled"];

/**
 * Sous-ensemble d'`ACTIVE` où une progression a un sens à afficher — un run tout juste
 * `queued` n'a encore rien à montrer (le worker ne l'a pas pris en charge). Distinct
 * d'`ACTIVE`, qui gouverne la disponibilité du bouton Annuler (annulable dès `queued`).
 * Revue adversariale du 15 août 2026 : `RunList` et `RunResults` géraient ce
 * sous-ensemble chacun de son côté, avec un risque de divergence silencieuse — un run
 * `queued` montrait une barre de progression sur l'écran de détail mais pas dans la
 * liste, pour le MÊME statut.
 */
export const LIVE: RunStatus[] = ["waiting", "running"];

export const STATUS_META: Record<
  RunStatus,
  { label: string; icon: typeof Clock; className: string; hint?: string }
> = {
  queued: { label: "en file", icon: CircleDashed, className: "text-ink-muted" },
  waiting: {
    label: "en attente d'allocation",
    icon: Clock,
    className: "text-warning",
    hint: "réservé sur Grid'5000, en attente d'un nœud",
  },
  running: { label: "en cours", icon: Loader2, className: "text-accent" },
  succeeded: { label: "terminé", icon: CheckCircle2, className: "text-success" },
  partial: {
    label: "partiel",
    icon: TriangleAlert,
    className: "text-warning",
    hint: "walltime atteint — les plis calculés sont conservés",
  },
  failed: { label: "échec", icon: XCircle, className: "text-danger" },
  cancelled: { label: "annulé", icon: Ban, className: "text-ink-muted" },
};

/**
 * Le champ `progress` n'est réellement mis à jour en direct QUE pour les runs locaux
 * (relu depuis `progress.json` toutes les 2 s par le worker). Pour Grid'5000, il reste
 * à 0 tout le temps de l'attente/exécution distante puis saute à 100 à l'ingestion —
 * un pourcentage qui ne bouge jamais n'est pas une vraie progression, juste un 0%
 * trompeur. Une barre indéterminée dit la vérité : « ça avance, sans chiffre fiable ».
 */
export function isProgressLive(computeTarget: string | null | undefined, progress: number): boolean {
  return computeTarget !== "g5k" || progress > 0;
}

/** Durée écoulée depuis `fromIso`, format court FR ("12 s", "3 min 20 s", "1 h 04"). */
export function elapsedLabel(fromIso: string | null | undefined, nowMs: number): string | null {
  if (!fromIso) return null;
  const from = Date.parse(fromIso);
  if (Number.isNaN(from)) return null;
  const totalSeconds = Math.max(0, Math.floor((nowMs - from) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")}`;
  if (minutes > 0) return `${minutes} min ${String(seconds).padStart(2, "0")} s`;
  return `${seconds} s`;
}

/**
 * Le worker envoie un battement à CHAQUE cycle de sondage (y compris pendant une
 * attente Grid'5000 de plusieurs heures) — un battement plus vieux que ce seuil signale
 * un worker probablement mort plutôt qu'un job simplement lent, distinction jusqu'ici
 * invisible côté client (`heartbeat_at` n'atteignait pas le frontend avant ce lot).
 * Seuil aligné sur `HEARTBEAT_TIMEOUT` côté serveur (`services.py`, 20 min) — au-delà,
 * le prochain passage du worker reprend de toute façon le run comme zombie.
 */
export const STALE_HEARTBEAT_MS = 20 * 60 * 1000;

export function isStaleHeartbeat(heartbeatAtIso: string | null | undefined, nowMs: number): boolean {
  if (!heartbeatAtIso) return false;
  const at = Date.parse(heartbeatAtIso);
  if (Number.isNaN(at)) return false;
  return nowMs - at > STALE_HEARTBEAT_MS;
}
