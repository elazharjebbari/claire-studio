"use client";

/**
 * Détail d'une campagne (admin) — gestion de bout en bout (plan §F1/F2/F6/F7).
 * Onglets : Assignations (matrice documents × annotateurs + assignation en masse),
 * Avancement (par annotateur), IAA (accord κ), Membres, Publication.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, Lock, LockOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/endpoints";
import {
  qk,
  useProject,
  useCorpusDocuments,
  useMembers,
  useAssignments,
  useProjectDocuments,
  useAnnotatorsProgress,
  useProjectIaa,
} from "@/lib/api/hooks";
import { Panel, Button, Badge, StatusPill } from "@/components/ui/primitives";
import { GoldConfigStudio } from "@/components/gold/GoldConfigStudio";
import type { IaaPair } from "@/types/contract";

type Tab = "assign" | "sessions" | "progress" | "iaa" | "members" | "resolution" | "publish";

export default function CampaignDetail({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("assign");
  const { data: project } = useProject(slug);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "assign", label: "Assignations" },
    { id: "sessions", label: "Suivi des sessions" },
    { id: "progress", label: "Avancement" },
    { id: "iaa", label: "Accord (IAA)" },
    { id: "members", label: "Membres" },
    { id: "resolution", label: "Résolution" },
    { id: "publish", label: "Publication" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-2 text-sm">
        <Link href="/admin/projects" className="text-accent hover:underline">
          ← Campagnes
        </Link>
      </div>
      <h1 className="font-display text-2xl font-semibold text-ink">
        {project?.name ?? slug}
      </h1>
      <p className="mt-0.5 text-sm text-ink-muted">
        Corpus {project?.corpusSlug ?? "…"} · schéma {project?.schemeSlug ?? "…"} ·
        gestion de la campagne, des assignations et de l'accord inter-annotateurs.
      </p>

      <div className="mt-5 flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            data-testid={`tab-${t.id}`}
            className={
              "rounded-t-md px-3 py-2 text-sm transition-colors " +
              (tab === t.id
                ? "border-b-2 border-accent font-medium text-ink"
                : "text-ink-muted hover:text-ink")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "assign" && <AssignTab slug={slug} corpusSlug={project?.corpusSlug} qc={qc} />}
        {tab === "sessions" && <SessionsTab slug={slug} />}
        {tab === "progress" && <ProgressTab slug={slug} />}
        {tab === "iaa" && <IaaTab slug={slug} />}
        {tab === "members" && <MembersTab slug={slug} qc={qc} />}
        {tab === "resolution" && <ResolutionTab slug={slug} />}
        {tab === "publish" && <PublishTab slug={slug} qc={qc} />}
      </div>
    </div>
  );
}

// ── Assignations : matrice documents × annotateurs ─────────────────────────────
function ResolutionTab({ slug }: { slug: string }) {
  return (
    <div data-testid="resolution-tab">
      <p className="mb-4 text-sm text-ink-muted">
        Arbitrage des conflits <strong>entre annotateurs</strong> (les modèles LLM restent une simple
        référence). Réglez qui arbitre et l'auto-résolution, puis ouvrez le{" "}
        <Link href={`/projects/${slug}/gold`} className="text-accent hover:underline">
          cockpit de résolution
        </Link>
        .
      </p>
      <GoldConfigStudio slug={slug} embedded />
    </div>
  );
}

function AssignTab({
  slug,
  corpusSlug,
  qc,
}: {
  slug: string;
  corpusSlug: string | undefined;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const { data: docs } = useCorpusDocuments(corpusSlug ?? "", 500);
  const { data: members } = useMembers(slug);
  const { data: assignments } = useAssignments(slug);
  const [busy, setBusy] = useState<string | null>(null);
  const [overlap, setOverlap] = useState(2);
  const [bulkBusy, setBulkBusy] = useState(false);

  const annotators = (members?.results ?? []).filter(
    (m) => m.role === "annotator" || m.role === "lead",
  );
  const documents = docs?.results ?? [];

  // (documentId|assigneeId) -> assignmentId
  const map = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of assignments?.results ?? []) {
      m.set(`${a.document.id}|${a.assigneeId}`, a.id);
    }
    return m;
  }, [assignments]);

  async function toggle(docId: string, docExt: string, userId: string) {
    const key = `${docId}|${userId}`;
    const existing = map.get(key);
    setBusy(key);
    try {
      if (existing) await api.deleteAssignment(slug, existing);
      else await api.createAssignment(slug, docExt, userId);
      await qc.invalidateQueries({ queryKey: qk.assignments(slug) });
    } finally {
      setBusy(null);
    }
  }

  async function assignOverlap() {
    setBulkBusy(true);
    try {
      await api.bulkAssign(slug, { documents: "all", overlap });
      await qc.invalidateQueries({ queryKey: qk.assignments(slug) });
    } finally {
      setBulkBusy(false);
    }
  }

  if (annotators.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Aucun annotateur dans la campagne. Ajoutez des membres dans l'onglet
        « Membres » avant d'assigner.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-line bg-panel-muted px-3 py-2">
        <span className="text-sm font-medium text-ink">Assignation en masse :</span>
        <label className="flex items-center gap-1.5 text-sm text-ink-muted">
          chaque document à
          <input
            type="number"
            min={1}
            max={annotators.length}
            value={overlap}
            onChange={(e) => setOverlap(Number(e.target.value))}
            className="w-14 rounded-md border border-line bg-panel px-2 py-1 text-sm text-ink"
          />
          annotateur(s) — recouvrement pour l'IAA
        </label>
        <Button variant="primary" disabled={bulkBusy} onClick={assignOverlap} data-testid="bulk-overlap">
          {bulkBusy ? "Assignation…" : "Répartir (round-robin)"}
        </Button>
        <span className="text-xs text-ink-muted">
          {documents.length} documents · {annotators.length} annotateurs
        </span>
      </div>

      <Panel className="overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="sticky left-0 bg-panel px-3 py-2 text-left font-medium text-ink">
                Document
              </th>
              {annotators.map((a) => (
                <th key={a.userId} className="px-3 py-2 text-center font-medium text-ink-muted">
                  {a.displayName || a.username}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id} className="border-b border-line/60">
                <td className="sticky left-0 bg-panel px-3 py-2 text-ink">{d.title}</td>
                {annotators.map((a) => {
                  const key = `${d.id}|${a.userId}`;
                  const assigned = map.has(key);
                  return (
                    <td key={a.userId} className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={assigned}
                        disabled={busy === key}
                        onChange={() => toggle(d.id, d.externalId, a.userId)}
                        aria-label={`Assigner ${d.title} à ${a.username}`}
                        className="h-4 w-4 cursor-pointer accent-[rgb(var(--surface-accent))]"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={annotators.length + 1} className="px-3 py-6 text-center text-ink-muted">
                  Aucun document dans le corpus.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

// ── Suivi des sessions : matrice document × annotateur + lecture seule ─────────
// Supervision (ADR-001) : l'admin voit l'état de la session de CHAQUE annotateur sur
// CHAQUE document, et peut OUVRIR une session en LECTURE SEULE (icône œil → workspace
// avec bannière « Lecture seule », écriture refusée par IsAnnotationOwner). Source :
// GET /projects/{slug}/documents (sessions[] réservé admin/lead), 1 ligne par document.
function SessionsTab({ slug }: { slug: string }) {
  const { data, isLoading } = useProjectDocuments(slug);
  const rows = useMemo(() => data?.results ?? [], [data]);

  // Colonnes = annotateurs (union des sessions, robuste si un doc diffère).
  const annotators = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    for (const r of rows) {
      for (const s of r.sessions ?? []) {
        if (!seen.has(String(s.annotatorId))) {
          seen.set(String(s.annotatorId), {
            id: String(s.annotatorId),
            name: s.displayName || s.username,
          });
        }
      }
    }
    return Array.from(seen.values());
  }, [rows]);

  if (!isLoading && annotators.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Aucune session à suivre : ajoutez des annotateurs (onglet « Membres ») et
        assignez-leur des documents (onglet « Assignations »).
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-ink-muted">
        État de la <strong className="text-ink">session de chaque annotateur</strong> par
        document (chacun annote seul). L'icône{" "}
        <Eye size={12} aria-hidden className="inline" /> ouvre une session en{" "}
        <strong className="text-ink">lecture seule</strong> (supervision — non modifiable).
      </p>
      <Panel className="overflow-auto">
        <table className="w-full border-collapse text-sm" data-testid="sessions-matrix">
          <thead>
            <tr className="border-b border-line">
              <th className="sticky left-0 bg-panel px-3 py-2 text-left font-medium text-ink">
                Document
              </th>
              {annotators.map((a) => (
                <th key={a.id} className="px-3 py-2 text-center font-medium text-ink-muted">
                  {a.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const byAnnotator = new Map(
                (r.sessions ?? []).map((s) => [String(s.annotatorId), s]),
              );
              return (
                <tr key={r.document.id} className="border-b border-line/60">
                  <td className="sticky left-0 bg-panel px-3 py-2 text-ink">
                    {r.document.title}
                  </td>
                  {annotators.map((a) => {
                    const s = byAnnotator.get(a.id);
                    const status = s?.status ?? "unstarted";
                    return (
                      <td key={a.id} className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <StatusPill status={status} />
                          {s?.annotationId ? (
                            <Link
                              href={`/annotate/${s.annotationId}`}
                              title={`Ouvrir la session de ${a.name} en lecture seule`}
                              aria-label={`Ouvrir la session de ${a.name} sur ${r.document.title} en lecture seule`}
                              data-testid={`session-view-${r.document.id}-${a.id}`}
                              className="text-ink-muted hover:text-accent"
                            >
                              <Eye size={14} aria-hidden />
                            </Link>
                          ) : (
                            <span className="inline-block w-[14px]" aria-hidden />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={annotators.length + 1} className="px-3 py-6 text-center text-ink-muted">
                  Aucun document.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

// ── Avancement par annotateur ──────────────────────────────────────────────────
function ProgressTab({ slug }: { slug: string }) {
  const { data } = useAnnotatorsProgress(slug);
  const rows = data?.results ?? [];
  return (
    <Panel className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-ink-muted">
            <th className="px-3 py-2 font-medium">Annotateur</th>
            <th className="px-3 py-2 font-medium">Rôle</th>
            <th className="px-3 py-2 font-medium">Assignés</th>
            <th className="px-3 py-2 font-medium">Démarrés</th>
            <th className="px-3 py-2 font-medium">Soumis</th>
            <th className="px-3 py-2 font-medium">Avancement</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} className="border-b border-line/60">
              <td className="px-3 py-2 text-ink">{r.displayName || r.username}</td>
              <td className="px-3 py-2"><Badge>{r.role}</Badge></td>
              <td className="px-3 py-2 text-ink">{r.assigned}</td>
              <td className="px-3 py-2 text-ink">{r.started}</td>
              <td className="px-3 py-2 text-ink">{r.submitted}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-28 overflow-hidden rounded-full bg-panel-muted">
                    <div className="h-full bg-accent" style={{ width: `${r.pct}%` }} />
                  </div>
                  <span className="text-xs text-ink-muted">{r.pct}%</span>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-ink-muted">
                Aucun membre.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Panel>
  );
}

// ── Accord inter-annotateurs (IAA) ─────────────────────────────────────────────
/** Échappement CSV minimal (RFC 4180) : guillemets si virgule/quote/retour ligne. */
function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function IaaTab({ slug }: { slug: string }) {
  const { data: iaa } = useProjectIaa(slug);
  const kappa = iaa?.meanKappa;
  const detail = iaa?.detail;
  const pairs = useMemo(() => iaa?.pairs ?? [], [iaa]);

  // Matrice paire-à-paire regroupée par document (drill-down R3 : où κ chute).
  const byDocument = useMemo(() => {
    const m = new Map<string, IaaPair[]>();
    for (const p of pairs) {
      const arr = m.get(p.document) ?? [];
      arr.push(p);
      m.set(p.document, arr);
    }
    return Array.from(m.entries());
  }, [pairs]);

  function kappaColor(k: number | null | undefined) {
    if (k == null) return "text-ink-muted";
    if (k < 0.4) return "text-danger";
    if (k < 0.6) return "text-warning";
    return "text-success";
  }

  // Export CSV côté client (BOM U+FEFF pour Excel ; échappement RFC 4180).
  function exportCsv() {
    const header = ["document", "annotateur_a", "annotateur_b", "kappa", "n_phrases"];
    const rows = pairs.map((p) => [
      p.document,
      p.annotatorA,
      p.annotatorB,
      String(p.kappa),
      String(p.nSentences),
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iaa-${slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink-muted">
          L'accord inter-annotateurs (κ de Cohen) se calcule sur les annotations
          <strong className="text-ink"> soumises</strong> des documents annotés par au moins
          2 annotateurs.
        </p>
        {pairs.length > 0 && (
          <Button variant="outline" onClick={exportCsv} data-testid="iaa-export-csv">
            <Download size={14} aria-hidden /> Exporter CSV
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Panel className="p-4">
          <div className="text-xs text-ink-muted">κ global (moyen)</div>
          <div className={"mt-1 text-2xl font-semibold " + kappaColor(kappa)}>
            {kappa != null ? kappa.toFixed(2) : "—"}
          </div>
        </Panel>
        <Panel className="p-4">
          <div className="text-xs text-ink-muted">
            Frontières reconstruites{detail?.boundaryJaccard != null ? " (Jaccard)" : ""}
          </div>
          <div className="mt-1 text-2xl font-semibold text-ink">
            {(detail?.boundaryJaccard ?? detail?.boundaryKappa) != null
              ? (detail!.boundaryJaccard ?? detail!.boundaryKappa).toFixed(2)
              : "—"}
          </div>
        </Panel>
        <Panel className="p-4">
          <div className="text-xs text-ink-muted">Paires d'annotateurs</div>
          <div className="mt-1 text-2xl font-semibold text-ink">
            {detail?.annotatorPairs ?? 0}
          </div>
        </Panel>
      </div>
      {detail?.perTheme && detail.perTheme.length > 0 && (
        <Panel className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-muted">
                <th className="px-3 py-2 font-medium">Thème</th>
                <th className="px-3 py-2 font-medium">κ</th>
                <th className="px-3 py-2 font-medium">Support</th>
              </tr>
            </thead>
            <tbody>
              {detail.perTheme.map((t) => (
                <tr key={t.code} className="border-b border-line/60">
                  <td className="px-3 py-2 text-ink">{t.label || t.code}</td>
                  <td className={"px-3 py-2 font-medium " + kappaColor(t.kappa)}>
                    {t.kappa.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-ink-muted">{t.support}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
      {/* Matrice paire-à-paire par document (R3) — repère où l'accord chute. */}
      {byDocument.length > 0 && (
        <Panel className="overflow-auto">
          <div className="border-b border-line px-3 py-2 text-sm font-medium text-ink">
            Accord paire-à-paire par document
          </div>
          <table className="w-full text-sm" data-testid="iaa-pairwise">
            <thead>
              <tr className="border-b border-line text-left text-ink-muted">
                <th className="px-3 py-2 font-medium">Document</th>
                <th className="px-3 py-2 font-medium">Annotateur A</th>
                <th className="px-3 py-2 font-medium">Annotateur B</th>
                <th className="px-3 py-2 font-medium">κ</th>
                <th className="px-3 py-2 font-medium">Phrases</th>
              </tr>
            </thead>
            <tbody>
              {byDocument.map(([doc, ps]) =>
                ps.map((p, i) => (
                  <tr
                    key={`${doc}|${p.annotatorA}|${p.annotatorB}`}
                    className="border-b border-line/60"
                  >
                    <td className="px-3 py-2 text-ink">{i === 0 ? doc : ""}</td>
                    <td className="px-3 py-2 text-ink-muted">{p.annotatorA}</td>
                    <td className="px-3 py-2 text-ink-muted">{p.annotatorB}</td>
                    <td className={"px-3 py-2 font-medium " + kappaColor(p.kappa)}>
                      {p.kappa.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-ink-muted">{p.nSentences}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </Panel>
      )}

      {kappa == null && (
        <p className="rounded-md border border-line bg-panel-muted px-3 py-2 text-sm text-ink-muted">
          Pas encore d'accord calculable : il faut au moins 2 annotations soumises sur un
          même document.
        </p>
      )}
    </div>
  );
}

// ── Membres ─────────────────────────────────────────────────────────────────────
function MembersTab({ slug, qc }: { slug: string; qc: ReturnType<typeof useQueryClient> }) {
  const { data } = useMembers(slug);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("annotator");
  const [busy, setBusy] = useState(false);
  const members = data?.results ?? [];

  async function add() {
    if (!username.trim()) return;
    setBusy(true);
    try {
      await api.addMember(slug, username.trim(), role);
      setUsername("");
      await qc.invalidateQueries({ queryKey: qk.members(slug) });
    } finally {
      setBusy(false);
    }
  }
  async function remove(userId: string) {
    await api.removeMember(slug, userId);
    await qc.invalidateQueries({ queryKey: qk.members(slug) });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-panel-muted px-3 py-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="nom d'utilisateur"
          className="rounded-md border border-line bg-panel px-2 py-1 text-sm text-ink"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-md border border-line bg-panel px-2 py-1 text-sm text-ink"
        >
          <option value="annotator">annotator</option>
          <option value="reviewer">reviewer</option>
          <option value="lead">lead</option>
        </select>
        <Button variant="primary" disabled={busy} onClick={add} data-testid="add-member">
          Ajouter
        </Button>
      </div>
      <Panel className="divide-y divide-line">
        {members.map((m) => (
          <div key={m.userId} className="flex items-center justify-between px-4 py-2">
            <span className="text-sm text-ink">
              {m.displayName || m.username}{" "}
              <span className="text-ink-muted">@{m.username}</span>
            </span>
            <div className="flex items-center gap-3">
              <Badge>{m.role}</Badge>
              <button
                type="button"
                onClick={() => remove(m.userId)}
                className="text-xs text-danger hover:underline"
              >
                Retirer
              </button>
            </div>
          </div>
        ))}
        {members.length === 0 && (
          <div className="px-4 py-6 text-sm text-ink-muted">Aucun membre.</div>
        )}
      </Panel>
    </div>
  );
}

// ── Publication ─────────────────────────────────────────────────────────────────
function PublishTab({ slug, qc }: { slug: string; qc: ReturnType<typeof useQueryClient> }) {
  const { data: project } = useProject(slug);
  const [busy, setBusy] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const isPublic = project?.visibility === "public";
  const isLocked = !!project?.locked;

  async function toggle() {
    setBusy(true);
    try {
      await api.setProjectVisibility(slug, isPublic ? "private" : "public");
      await qc.invalidateQueries({ queryKey: qk.project(slug) });
    } finally {
      setBusy(false);
    }
  }

  async function toggleLock() {
    if (!isLocked && !window.confirm(
      "Verrouiller le projet gèle l'édition de TOUTES les sessions de la campagne " +
        "(les annotateurs passent en lecture seule et ne peuvent pas déverrouiller). Continuer ?",
    )) {
      return;
    }
    setLockBusy(true);
    try {
      await (isLocked ? api.unlockProject(slug) : api.lockProject(slug));
      await qc.invalidateQueries({ queryKey: qk.project(slug) });
    } finally {
      setLockBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-ink">
              Visibilité : {isPublic ? "Publique" : "Privée"}
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              Un projet public expose ses agrégats (KPI, distribution de thèmes, IAA) en
              lecture seule sur la page publique. Aucune donnée d'annotation brute n'est exposée.
            </p>
          </div>
          <Button variant="outline" disabled={busy} onClick={toggle} data-testid="toggle-visibility">
            {isPublic ? "Dépublier" : "Publier"}
          </Button>
        </div>
      </Panel>

      <Panel className={"p-4 " + (isLocked ? "ring-1 ring-inset ring-amber-400/40" : "")}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 font-medium text-ink">
              {isLocked ? (
                <Lock size={15} aria-hidden className="text-amber-300" />
              ) : (
                <LockOpen size={15} aria-hidden className="text-ink-muted" />
              )}
              Verrouillage de campagne : {isLocked ? "Verrouillé" : "Déverrouillé"}
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              Le verrou de campagne <strong>gèle toutes les sessions</strong> du projet d'un
              coup : tous les annotateurs passent en lecture seule et ne peuvent pas
              déverrouiller leur session (édition et soumission refusées). Réversible à tout
              moment ; les verrous de session individuels ne sont pas affectés.
            </p>
          </div>
          <Button
            variant={isLocked ? "primary" : "outline"}
            disabled={lockBusy}
            onClick={toggleLock}
            data-testid="toggle-project-lock"
          >
            {isLocked ? "Déverrouiller le projet" : "Verrouiller le projet"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
