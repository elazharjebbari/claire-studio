"use client";

/**
 * Cible de calcul et identifiants Grid'5000.
 *
 * DEUX secrets distincts, saisis dans le même formulaire mais jamais confondus : le
 * mot de passe authentifie l'API REST (HTTP Basic), la clé SSH authentifie
 * exclusivement le transfert de fichiers (rsync) — Grid'5000 désactive
 * l'authentification par mot de passe en SSH (docs/pactiva-g5k/07_ARCHITECTURE.md §1).
 * Un identifiant peut donc avoir l'un sans l'autre, et les DEUX résultats de test
 * restent visibles séparément — jamais un seul badge agrégé qui masquerait lequel des
 * deux corriger.
 *
 * Règles héritées de la version précédente, inchangées :
 * * les secrets ne sont **jamais réaffichés** — les champs restent vides même quand un
 *   secret existe ;
 * * le **test de connexion** est explicite : mieux vaut découvrir un identifiant faux
 *   maintenant qu'après une réservation de quatre heures ;
 * * si le serveur ne peut pas chiffrer, la fonction est **désactivée avec son motif**,
 *   jamais masquée sans explication.
 */

import { useEffect, useState } from "react";
import { KeyRound, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

import { Button, Panel } from "@/components/ui/primitives";

import { getCredentials, saveCredential, testCredential } from "./api";
import type { ComputeCredential } from "./types";

function TestBadge({ label, state }: { label: string; state: boolean | null }) {
  const Icon = state === true ? ShieldCheck : state === false ? ShieldAlert : ShieldQuestion;
  const cls = state === true ? "text-success" : state === false ? "text-danger" : "text-ink-muted";
  return (
    <span className={`flex items-center gap-1.5 ${cls}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label} : {state === true ? "opérationnel" : state === false ? "échec" : "non testé"}
    </span>
  );
}

export function ComputeSettings() {
  const [configured, setConfigured] = useState(true);
  const [credentials, setCredentials] = useState<ComputeCredential[]>([]);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [sshKey, setSshKey] = useState("");
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
      await saveCredential({
        kind: "g5k",
        login,
        // Vide = préserver le mot de passe déjà enregistré (permet d'ajouter/modifier
        // SEULEMENT la clé SSH sans le retaper), symétrique au traitement de `sshKey`.
        password: password || undefined,
        sshKey: sshKey || undefined,
      });
      // Les secrets sont effacés de l'état dès l'enregistrement : ils ne doivent pas
      // rester en mémoire du navigateur plus longtemps que nécessaire.
      setPassword("");
      setSshKey("");
      setMessage("Identifiants enregistrés (chiffrés au repos).");
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
      setMessage(result.detail);
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
        <span className="text-ink-muted">Mot de passe (API)</span>
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
        <span className="mt-1 block text-xs text-ink-muted">
          Chiffré au repos et jamais réaffiché — pas même à vous. Authentifie l&apos;API
          Grid&apos;5000 (réservation, suivi des runs).
        </span>
      </label>

      <label className="block text-xs">
        <span className="text-ink-muted">Clé SSH privée (transfert de fichiers)</span>
        <textarea
          className="mt-1 h-24 w-full rounded border border-line bg-panel-muted p-2 font-mono text-xs text-ink"
          value={sshKey}
          onChange={(e) => setSshKey(e.target.value)}
          placeholder={existing?.hasSshKey ? "•••••••• (enregistrée)" : "-----BEGIN OPENSSH PRIVATE KEY-----"}
          spellCheck={false}
          disabled={!configured}
          data-testid="g5k-ssh-key"
        />
        <span className="mt-1 block text-xs text-ink-muted">
          Grid&apos;5000 <strong>désactive l&apos;authentification par mot de passe en
          SSH</strong> — sans cette clé, le transfert des données et des résultats
          échoue avant même la réservation. Générez une clé <strong>dédiée</strong> à
          Pactiva (<code>ssh-keygen -t ed25519 -f pactiva-g5k -N &quot;&quot;</code>),
          ajoutez-la à votre compte Grid&apos;5000, puis collez la clé{" "}
          <strong>privée</strong> ici — jamais une clé déjà utilisée ailleurs.
        </span>
      </label>

      <div className="flex items-center gap-2">
        <Button
          onClick={onSave}
          loading={busy}
          disabled={!configured || !login || (!password && !existing?.hasPassword)}
          title={
            !configured
              ? "clé de chiffrement absente côté serveur"
              : !login || (!password && !existing?.hasPassword)
                ? "identifiant et mot de passe requis"
                : "Enregistrer les identifiants chiffrés"
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
              ? "Vérifier l'API et, si une clé SSH est enregistrée, le transfert de fichiers"
              : "aucun identifiant enregistré à tester"
          }
          data-testid="g5k-test"
        >
          Tester la connexion
        </Button>
      </div>

      {existing?.lastTestedAt && (
        <div className="space-y-1 text-xs" data-testid="g5k-test-results">
          <TestBadge label="API" state={existing.lastTestOk} />
          <TestBadge label="Transfert SSH" state={existing.lastTestSshOk} />
          <p className="text-ink-muted">
            Dernier test : {new Date(existing.lastTestedAt).toLocaleString("fr-FR")}
          </p>
        </div>
      )}

      {message && (
        <p className="text-xs text-ink-muted" role="status" data-testid="compute-message">
          {message}
        </p>
      )}
    </Panel>
  );
}
