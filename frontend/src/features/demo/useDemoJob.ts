"use client";

/**
 * Lifecycle of one classification request: POST, then poll every 1 s (first 10 s) and every
 * 3 s afterwards, stop on `done` / `failed` or after 3 minutes. Errors are mapped to short
 * codes the panel turns into English messages; the pasted text never leaves this module
 * except in the single POST body.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { getDemoJob, startClassification, type ClassifyRequest, type DemoJob } from "@/lib/api/demo";

export type DemoPhase = "idle" | "submitting" | "queued" | "running" | "done" | "failed";

export type DemoErrorCode =
  | "empty"
  | "too_long"
  | "not_english"
  | "unknown_document"
  | "access_code_required"
  | "queue_full"
  | "throttled"
  | "timeout"
  | "model_unavailable"
  | "network"
  | "internal";

export interface DemoJobState {
  phase: DemoPhase;
  job: DemoJob | null;
  position: number | null;
  error: DemoErrorCode | null;
  elapsedS: number;
}

const POLL_FAST_MS = 1000;
const POLL_SLOW_MS = 3000;
const FAST_WINDOW_MS = 10_000;
const MAX_WAIT_MS = 180_000;

export function errorCodeFromApi(err: unknown): DemoErrorCode {
  if (err instanceof ApiError) {
    if (err.status === 429) return "throttled";
    const body = err.body as { code?: string } | undefined;
    const code = body?.code;
    if (code === "queue_full") return "queue_full";
    if (code === "access_code_required") return "access_code_required";
    if (code === "empty" || code === "too_long" || code === "not_english" || code === "unknown_document") return code;
    return "internal";
  }
  return "network";
}

export function useDemoJob(accessCode?: string) {
  const [state, setState] = useState<DemoJobState>({ phase: "idle", job: null, position: null, error: null, elapsedS: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef<number>(0);
  const cancelled = useRef(false);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => () => {
    cancelled.current = true;
    stop();
  }, [stop]);

  const poll = useCallback(
    async (jobId: string) => {
      if (cancelled.current) return;
      const elapsed = Date.now() - startedAt.current;
      try {
        const job = await getDemoJob(jobId);
        if (cancelled.current) return;
        if (job.status === "done") {
          setState({ phase: "done", job, position: null, error: null, elapsedS: elapsed / 1000 });
          return;
        }
        if (job.status === "failed") {
          const code = (job.error?.code as DemoErrorCode | undefined) ?? "internal";
          setState({ phase: "failed", job, position: null, error: code, elapsedS: elapsed / 1000 });
          return;
        }
        setState((s) => ({ ...s, phase: job.status === "running" ? "running" : "queued", job, elapsedS: elapsed / 1000 }));
      } catch (err) {
        if (cancelled.current) return;
        setState((s) => ({ ...s, phase: "failed", error: errorCodeFromApi(err), elapsedS: elapsed / 1000 }));
        return;
      }
      if (elapsed > MAX_WAIT_MS) {
        setState((s) => ({ ...s, phase: "failed", error: "timeout", elapsedS: elapsed / 1000 }));
        return;
      }
      timer.current = setTimeout(() => void poll(jobId), elapsed < FAST_WINDOW_MS ? POLL_FAST_MS : POLL_SLOW_MS);
    },
    [],
  );

  const submit = useCallback(
    async (request: ClassifyRequest) => {
      stop();
      cancelled.current = false;
      startedAt.current = Date.now();
      setState({ phase: "submitting", job: null, position: null, error: null, elapsedS: 0 });
      try {
        const accepted = await startClassification(request, accessCode);
        if (cancelled.current) return;
        setState({ phase: "queued", job: null, position: accepted.position, error: null, elapsedS: 0 });
        timer.current = setTimeout(() => void poll(accepted.jobId), POLL_FAST_MS);
      } catch (err) {
        if (cancelled.current) return;
        setState({ phase: "failed", job: null, position: null, error: errorCodeFromApi(err), elapsedS: 0 });
      }
    },
    [accessCode, poll, stop],
  );

  const reset = useCallback(() => {
    stop();
    setState({ phase: "idle", job: null, position: null, error: null, elapsedS: 0 });
  }, [stop]);

  return { state, submit, reset };
}
