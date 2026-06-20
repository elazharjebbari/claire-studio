"use client";

/**
 * Jonction via lien de partage (chantier D). L'utilisateur AUTHENTIFIÉ rejoint le
 * projet ; sinon on le renvoie vers la connexion (avec retour). Lien révoqué /
 * expiré / épuisé → message clair.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { joinShareLink } from "@/lib/api/endpoints";
import { Panel } from "@/components/ui/primitives";

export default function JoinPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"joining" | "error">("joining");
  const [message, setMessage] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    joinShareLink(params.token)
      .then((res) => router.replace(`/projects/${res.projectSlug}`))
      .catch((err: unknown) => {
        const status =
          err && typeof err === "object" && "status" in err
            ? (err as { status?: number }).status
            : undefined;
        if (status === 401) {
          // Jamais d'accès anonyme : on connecte d'abord, puis on revient ici.
          const next = encodeURIComponent(`/join/${params.token}`);
          router.replace(`/login?next=${next}`);
          return;
        }
        setMessage(
          status === 403
            ? "Ce lien de partage est révoqué, expiré ou épuisé."
            : "Lien de partage invalide.",
        );
        setPhase("error");
      });
  }, [params.token, router]);

  return (
    <div className="theme-light flex min-h-screen items-center justify-center bg-bg px-4 text-ink">
      <Panel className="w-full max-w-sm p-6 text-center" data-testid="join-page">
        <h1 className="text-xl font-semibold">
          <span className="font-display font-light tracking-[0.12em]">Pactiva</span>
        </h1>
        {phase === "joining" ? (
          <p className="mt-4 text-sm text-ink-muted">Connexion au projet partagé…</p>
        ) : (
          <div className="mt-4 text-sm text-ink-muted" data-testid="join-error">
            <p className="font-medium text-red-400">{message}</p>
            <Link href="/" className="mt-4 inline-block text-accent hover:underline">
              Retour à l'accueil
            </Link>
          </div>
        )}
      </Panel>
    </div>
  );
}
