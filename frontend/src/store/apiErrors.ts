"use client";

/**
 * Store des erreurs API surfacées à l'utilisateur (système de debug front).
 *
 * Alimenté par les `QueryCache`/`MutationCache` onError de react-query (voir
 * providers.tsx). Chaque entrée porte le status HTTP, l'endpoint et le message
 * pour un bandeau/toast lisible. Auto-dismiss géré côté composant.
 */

import { create } from "zustand";
import { ApiError } from "@/lib/api/client";

export interface ApiErrorEntry {
  id: string;
  status: number;
  /** Endpoint relatif (ex. "/projects") extrait du message de l'ApiError. */
  endpoint: string;
  message: string;
  at: number;
}

interface ApiErrorState {
  errors: ApiErrorEntry[];
  push: (err: unknown) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

let seq = 0;

/** Extrait un endpoint lisible depuis "API 404 on /projects". */
function parseEndpoint(message: string): string {
  const m = /on\s+(\S+)/.exec(message);
  return m?.[1] ?? "";
}

export const useApiErrorStore = create<ApiErrorState>((set) => ({
  errors: [],
  push: (err: unknown) => {
    if (!(err instanceof ApiError)) return;
    // On ignore le 401 « normal » : il déclenche le refresh / la garde d'auth,
    // ce n'est pas une erreur à surfacer à l'utilisateur en bandeau.
    if (err.status === 401) return;
    const entry: ApiErrorEntry = {
      id: `apierr-${++seq}`,
      status: err.status,
      endpoint: parseEndpoint(err.message),
      message: err.message,
      at: Date.now(),
    };
    set((s) => ({ errors: [...s.errors, entry].slice(-5) }));
  },
  dismiss: (id: string) => set((s) => ({ errors: s.errors.filter((e) => e.id !== id) })),
  clear: () => set({ errors: [] }),
}));
