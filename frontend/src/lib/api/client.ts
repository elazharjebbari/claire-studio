/**
 * Client API typé pour CLAIRE (CONTRACT §3, REST /api/v1/, JWT).
 *
 * - Ajoute automatiquement l'en-tête Authorization: Bearer <access>.
 * - Tente un refresh transparent sur 401 (une seule fois).
 * - Lève une `ApiError` structurée sur les statuts d'erreur.
 *
 * En dev, MSW intercepte ces appels (voir src/mocks). Le code est identique
 * branché à un vrai backend Django/DRF.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";

const ACCESS_KEY = "claire.access";
const REFRESH_KEY = "claire.refresh";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export const tokenStore = {
  getAccess(): string | null {
    return isBrowser() ? window.localStorage.getItem(ACCESS_KEY) : null;
  },
  getRefresh(): string | null {
    return isBrowser() ? window.localStorage.getItem(REFRESH_KEY) : null;
  },
  set(access: string, refresh?: string): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(ACCESS_KEY, access);
    if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear(): void {
    if (!isBrowser()) return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Désactive le retry après refresh (usage interne). */
  _retried?: boolean;
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { access: string };
    tokenStore.set(data.access);
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, _retried, ...rest } = options;
  const access = tokenStore.getAccess();

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !_retried) {
    const ok = await refreshAccessToken();
    if (ok) return apiFetch<T>(path, { ...options, _retried: true });
  }

  if (!res.ok) {
    let errBody: unknown = undefined;
    try {
      errBody = await res.json();
    } catch {
      /* corps non-JSON */
    }
    throw new ApiError(res.status, `API ${res.status} on ${path}`, errBody);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export { API_BASE };
