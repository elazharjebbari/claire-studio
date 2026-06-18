"use client";

/**
 * Traductions file-based (F8) — déclarer un TranslationSet (dossier source +
 * langue + stratégie de mapping), lancer la sync, afficher le mapping
 * document↔fichier. CONTRACT §3 : /translations/sets et /translations/sets/{id}/sync.
 */

import { useState } from "react";
import {
  useTranslationSets,
  useCreateTranslationSet,
  useSyncTranslationSet,
} from "@/lib/api/hooks";
import { Panel, Button, Field, Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { TranslationSet, TranslationSyncResult } from "@/types/contract";

const STRATEGIES: Array<{ value: TranslationSet["mappingStrategy"]; label: string }> = [
  { value: "external_id", label: "Par external_id (id de document)" },
  { value: "filename", label: "Par nom de fichier" },
  { value: "order", label: "Par ordre" },
];

function StatusBadge({ status }: { status: TranslationSet["status"] }) {
  const tone: Record<TranslationSet["status"], string> = {
    declared: "border-ink-muted/40 text-ink-muted",
    syncing: "border-accent/50 text-accent",
    synced: "border-emerald-500/50 text-emerald-400",
    error: "border-red-500/50 text-red-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone[status],
      )}
    >
      {status}
    </span>
  );
}

export default function AdminTranslations() {
  const { data } = useTranslationSets();
  const createSet = useCreateTranslationSet();
  const syncSet = useSyncTranslationSet();

  const [name, setName] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("fr");
  const [folderPath, setFolderPath] = useState("");
  const [mappingStrategy, setMappingStrategy] =
    useState<TranslationSet["mappingStrategy"]>("external_id");

  const [syncResult, setSyncResult] = useState<TranslationSyncResult | null>(null);

  function declareSet(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !folderPath.trim()) return;
    createSet.mutate(
      { name: name.trim(), targetLanguage, folderPath: folderPath.trim(), mappingStrategy },
      {
        onSuccess: () => {
          setName("");
          setFolderPath("");
        },
      },
    );
  }

  function runSync(id: string) {
    syncSet.mutate(id, { onSuccess: (res) => setSyncResult(res) });
  }

  const sets = data?.results ?? [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-xl font-semibold text-ink">Traductions</h1>
      <p className="mb-4 text-sm text-ink-muted">
        Déclaration de dossiers de traductions et mapping file-based (F8). Le mapping relie
        chaque document du corpus à un fichier de traduction.
      </p>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Déclaration d'un set */}
        <Panel className="h-fit p-4">
          <h2 className="mb-3 font-semibold text-ink">Déclarer un dossier source</h2>
          <form className="flex flex-col gap-3" onSubmit={declareSet} data-testid="translation-form">
            <Field label="Nom" htmlFor="ts-name">
              <input
                id="ts-name"
                data-testid="ts-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="CLAUDETTE FR"
                className="rounded-md border border-line bg-panel-muted px-2 py-1.5 text-sm text-ink"
              />
            </Field>
            <Field label="Langue cible" htmlFor="ts-language">
              <input
                id="ts-language"
                data-testid="ts-language"
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                placeholder="fr"
                className="rounded-md border border-line bg-panel-muted px-2 py-1.5 text-sm text-ink"
              />
            </Field>
            <Field label="Dossier source" htmlFor="ts-folder">
              <input
                id="ts-folder"
                data-testid="ts-folder"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="/data/translations/claudette_fr"
                className="rounded-md border border-line bg-panel-muted px-2 py-1.5 font-mono text-xs text-ink"
              />
            </Field>
            <Field label="Stratégie de mapping" htmlFor="ts-strategy">
              <select
                id="ts-strategy"
                data-testid="ts-strategy"
                value={mappingStrategy}
                onChange={(e) =>
                  setMappingStrategy(e.target.value as TranslationSet["mappingStrategy"])
                }
                className="rounded-md border border-line bg-panel-muted px-2 py-1.5 text-sm text-ink"
              >
                {STRATEGIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              type="submit"
              variant="primary"
              data-testid="declare-set"
              disabled={createSet.isPending}
            >
              {createSet.isPending ? "Déclaration…" : "Déclarer le dossier"}
            </Button>
          </form>
        </Panel>

        {/* Liste des sets + sync */}
        <div className="flex flex-col gap-4">
          <Panel className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-panel-muted text-left text-xs uppercase text-ink-muted">
                  <th className="px-4 py-2 font-semibold">Nom</th>
                  <th className="px-4 py-2 font-semibold">Langue</th>
                  <th className="px-4 py-2 font-semibold">Dossier</th>
                  <th className="px-4 py-2 font-semibold">Stratégie</th>
                  <th className="px-4 py-2 font-semibold">Statut</th>
                  <th className="px-4 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {sets.map((t) => (
                  <tr
                    key={t.id}
                    data-testid={`translation-set-${t.id}`}
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-4 py-2 text-ink">{t.name}</td>
                    <td className="px-4 py-2">
                      <Badge>{t.targetLanguage}</Badge>
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-xs text-ink-muted">{t.folderPath}</code>
                    </td>
                    <td className="px-4 py-2 text-ink-muted">{t.mappingStrategy}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={t.status} />
                      {t.mappedDocuments != null && (
                        <span className="ml-2 text-xs text-ink-muted">
                          {t.mappedDocuments} docs
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Button
                        variant="outline"
                        className="px-2 py-1 text-xs"
                        data-testid={`sync-${t.id}`}
                        disabled={syncSet.isPending}
                        onClick={() => runSync(t.id)}
                      >
                        Synchroniser
                      </Button>
                    </td>
                  </tr>
                ))}
                {sets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-sm text-ink-muted">
                      Aucun dossier de traduction déclaré.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Panel>

          {syncResult && (
            <Panel className="p-4" data-testid="sync-result">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold text-ink">Mapping document ↔ fichier</h2>
                <span className="text-xs text-ink-muted">
                  {syncResult.summary.matched} associés · {syncResult.summary.unmatched} non résolus
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase text-ink-muted">
                    <th className="px-2 py-1 font-semibold">Document</th>
                    <th className="px-2 py-1 font-semibold">Fichier</th>
                    <th className="px-2 py-1 font-semibold">État</th>
                  </tr>
                </thead>
                <tbody>
                  {syncResult.mapping.map((m) => (
                    <tr
                      key={m.documentId}
                      data-testid={`mapping-row-${m.documentId}`}
                      className="border-b border-line last:border-0"
                    >
                      <td className="px-2 py-1.5 text-ink">{m.documentTitle}</td>
                      <td className="px-2 py-1.5">
                        {m.filePath ? (
                          <code className="text-xs text-ink-muted">{m.filePath}</code>
                        ) : (
                          <span className="text-xs italic text-red-400">aucun fichier</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {m.matched ? (
                          <span className="text-xs text-emerald-400">associé</span>
                        ) : (
                          <span className="text-xs text-red-400">non résolu</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
