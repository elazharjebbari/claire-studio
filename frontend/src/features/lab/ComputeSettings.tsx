"use client";

/**
 * Cible de calcul et identifiants Grid'5000.
 *
 * Trois règles visibles dans cet écran :
 *
 * * le mot de passe **n'est jamais réaffiché** — l'API ne le renvoie pas, et le champ
 *   reste vide même quand un secret existe ;
 * * le **test de connexion** est explicite : mieux vaut découvrir un identifiant faux
 *   maintenant qu'après une réservation de quatre heures ;
 * * si le serveur ne peut pas chiffrer, la fonction est **désactivée avec son motif**,
 *   jamais masquée sans explication.
 */

import { useEffect, useState } from "react";
import { KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";

import { Button, Panel } from "@/components/ui/primitives";

import { getCredentials, saveCredential, testCredential } from "./api";
import type { ComputeCredential } from "./types";

export function ComputeSettings() {
  const [configured, setConfigured] = useState(true);
  const [credentials, setCredentials] = useState<ComputeCredential[]>([]);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = () =>
    getCredentials()
      .then((data) => {
        setConfigured(data.configured);
        setCredentials(data.credentials);
        const existing = data.credentials.find((c) => c.kind === "g5k");
        if (existing) setLogin(existing.login);
      })
      .catch(() => setConfigured(false));

  useEffect(() => {
    refresh();
  }, []);

  const existing = credentials.find((c) => c.kind === "g5k");

  const onSave = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await saveCredential({ kind: "g5k", login, password });
      // Le secret est effacé de l'état dès l'enregistrement : il ne doit pas rester en
      // mémoire du navigateur plus longtemps que nécessaire.
      setPassword("");
      setMessage("Identifiant enregistré (chiffré au repos).");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "échec de l'enregistrement");
    } finally {
      setBusy(false);
    }
  };

  const onTest = async () => {
    if (!existing) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await testCredential(existing.id);
      setMessage(result.ok ? `Connexion établie — ${result.detail}` : `Échec — ${result.detail}`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "échec du test");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="max-w-xl space-y-4 p-4" data-testid="compute-settings">
      <header className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-ink-muted" aria-hidden />
        <h3 className="text-sm font-semibold text-ink">Identifiants Grid&apos;5000</h3>
      </header>

      {!configured && (
        <p
          className="flex items-start gap-2 rounded border border-warning/40 bg-warning/5 p-3 text-xs text-ink-muted"
          data-testid="compute-not-configured"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          <span>
            Le serveur ne dispose pas de clé de chiffrement (<code>LAB_CREDENTIALS_KEY</code>)
            : l&apos;enregistrement d&apos;identifiants est refusé plutôt que fait en clair.
            L&apos;exécution <strong>locale</strong> reste pleinement disponible.
          </span>
        </p>
      )}

      <label className="block text-xs">
        <span className="text-ink-muted">Identifiant</span>
        <input
          type="text"
          autoComplete="username"
          className="mt-1 w-full rounded border border-line bg-panel-muted px-2 py-1 text-ink"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          disabled={!configured}
          data-testid="g5k-login"
        />
      </label>

      <label className="block text-xs">
        <span className="text-ink-muted">Mot de passe</span>
        <input
          type="password"
          autoComplete="new-password"
          className="mt-1 w-full rounded border border-line bg-panel-muted px-2 py-1 text-ink"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={existing?.hasPassword ? "•••••••• (enregistré)" : ""}
          disabled={!configured}
          data-testid="g5k-password"
        />
        <span className="mt-1 block text-[10px] text-ink-muted">
          Chiffré au repos et jamais réaffiché — pas même à vous. Utilisé uniquement pour
          soumettre vos jobs, sous votre compte.
        </span>
      </label>

      <div className="flex items-center gap-2">
        <Button
          onClick={onSave}
          loading={busy}
          disabled={!configured || !login || !password}
          title={
            !configured
              ? "clé de chiffrement absente côté serveur"
              : !login || !password
                ? "identifiant et mot de passe requis"
                : "Enregistrer l'identifiant chiffré"
          }
          data-testid="g5k-save"
        >
          Enregistrer
        </Button>
        <Button
          variant="outline"
          onClick={onTest}
          disabled={!existing?.hasPassword || busy}
          title={
            existing?.hasPassword
              ? "Vérifier la connexion à l'API Grid'5000"
              : "aucun identifiant enregistré à tester"
          }
          data-testid="g5k-test"
        >
          Tester la connexion
        </Button>
      </div>

      {existing?.lastTestedAt && (
        <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          {existing.lastTestOk ? (
            <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5 text-danger" aria-hidden />
          )}
          Dernier test : {new Date(existing.lastTestedAt).toLocaleString("fr-FR")} —{" "}
          {existing.lastTestDetail}
        </p>
      )}

      {message && (
        <p className="text-[11px] text-ink-muted" role="status" data-testid="compute-message">
          {message}
        </p>
      )}
    </Panel>
  );
}
