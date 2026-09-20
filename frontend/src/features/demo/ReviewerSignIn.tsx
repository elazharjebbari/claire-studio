"use client";

/**
 * One-click reviewer sign-in. The shared reviewer account is a guest account: it reads the 150
 * annotation sessions of the frozen campaign and the gold standard, annotates only in its own
 * sandbox sessions, and has no access to configuration, lab or exports (enforced server-side).
 * Credentials come from the public demo manifest, which serves them only when the project owner
 * enabled it on the server.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/primitives";
import { login } from "@/lib/api/endpoints";
import { getDemoManifest } from "@/lib/api/demo";

type Access = { username: string; password: string; campaign: string; sandbox: string } | null;

export function ReviewerSignIn() {
  const router = useRouter();
  const [access, setAccess] = useState<Access | undefined>(undefined);
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");

  useEffect(() => {
    getDemoManifest()
      .then((m) => setAccess(m.reviewerAccess ?? null))
      .catch(() => setAccess(null));
  }, []);

  if (access === undefined) return null;
  if (access === null) {
    return (
      <p className="mt-2 text-[13px] text-ink-muted" data-testid="reviewer-signin-unavailable">
        The credentials are provided with the submission; they can also be requested by e-mail.
      </p>
    );
  }

  async function signIn() {
    if (!access) return;
    setState("pending");
    try {
      await login(access.username, access.password);
      router.push(`/projects/${access.campaign}/docs`);
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3" data-testid="reviewer-signin">
      <Button variant="primary" icon={<LogIn size={14} aria-hidden />} state={state} onClick={() => void signIn()}>
        {state === "error" ? "Try again" : "Sign in as reviewer"}
      </Button>
      <span className="font-mono text-[12px] text-ink-muted">
        {access.username} · {access.password}
      </span>
      <span className="text-[12px] text-ink-muted">
        Opens the frozen campaign (read only). Your own annotations go to the sandbox project “{access.sandbox}”.
      </span>
    </div>
  );
}
