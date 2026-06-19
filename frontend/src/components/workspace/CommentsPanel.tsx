"use client";

/**
 * CommentsPanel (point 3) — commentaires MULTI-NIVEAUX : document, phrase, sélection
 * (bloc/plage) ou clause. Liste groupée par portée, filtrable (non résolus / à moi),
 * composer avec sélecteur de portée contextualisé. Couleurs d'auteur (contributeurs).
 *
 * Ergonomie : panneau latéral togglable, ancres lisibles (« 📄 général », « ¶ 9 »,
 * « ¶ 16–17 », « clause @22 »), résolution en un clic, réponses à venir (thread_root).
 */

import { useMemo, useState } from "react";
import {
  useAddComment,
  useComments,
  useContributors,
  useResolveComment,
} from "@/lib/api/hooks";
import { useWorkspaceStore, selectSelectedDraft } from "@/store/workspace";
import type { Comment, CommentScope } from "@/types/contract";

type ComposerScope = "document" | "sentence" | "range" | "clause";
type Filter = "all" | "unresolved";

function scopeLabel(c: Comment): string {
  switch (c.scope) {
    case "document":
      return "📄 général";
    case "sentence":
      return `¶ ${c.sentenceIndex}`;
    case "range":
      return `¶ ${c.rangeStart}–${c.rangeEnd}`;
    default:
      return "clause";
  }
}

export function CommentsPanel({
  annotationId,
  documentId,
  onClose,
}: {
  annotationId: string;
  documentId?: string;
  onClose: () => void;
}) {
  const { data } = useComments(annotationId);
  const { data: contributors } = useContributors(documentId);
  const addComment = useAddComment(annotationId);
  const resolve = useResolveComment(annotationId);

  const focused = useWorkspaceStore((s) => s.focusedSentence);
  const selected = useWorkspaceStore((s) => s.selectedSentences);
  const draft = useWorkspaceStore(selectSelectedDraft);

  const [scope, setScope] = useState<ComposerScope>("document");
  const [body, setBody] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const nameOf = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const c of contributors?.results ?? []) map.set(c.userId, { name: c.name, color: c.color });
    return map;
  }, [contributors]);

  const comments = (data?.results ?? []).filter((c) => (filter === "all" ? true : !c.resolved));
  const hasRange = selected.length >= 2;

  const COMPOSER_SCOPES: { value: ComposerScope; label: string; enabled: boolean }[] = [
    { value: "document", label: "📄 Général", enabled: true },
    { value: "sentence", label: `¶ Phrase ${focused}`, enabled: true },
    {
      value: "range",
      label: hasRange ? `¶ Sélection ${selected[0]}–${selected[selected.length - 1]}` : "¶ Sélection",
      enabled: hasRange,
    },
    { value: "clause", label: draft ? `Clause @${draft.anchorIndex}` : "Clause", enabled: Boolean(draft) },
  ];

  function submit() {
    if (!body.trim()) return;
    const payload: Parameters<typeof addComment.mutate>[0] = { body: body.trim() };
    if (scope === "document") payload.scope = "document";
    else if (scope === "sentence") {
      payload.scope = "sentence";
      payload.sentenceIndex = focused;
    } else if (scope === "range" && hasRange) {
      payload.scope = "range";
      payload.rangeStart = selected[0];
      payload.rangeEnd = selected[selected.length - 1];
    } else if (scope === "clause" && draft) {
      payload.scope = "clause";
      payload.clauseId = draft.serverId ?? undefined;
    }
    addComment.mutate(payload);
    setBody("");
  }

  return (
    <aside
      data-testid="comments-panel"
      aria-label="Commentaires"
      className="flex h-full w-80 shrink-0 flex-col border-l border-line bg-elevated"
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink">
          Commentaires ({comments.length})
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="comments-filter"
            onClick={() => setFilter((f) => (f === "all" ? "unresolved" : "all"))}
            className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-muted hover:bg-panel-muted"
          >
            {filter === "all" ? "Tous" : "Non résolus"}
          </button>
          <button
            type="button"
            data-testid="comments-close"
            aria-label="Fermer les commentaires"
            onClick={onClose}
            className="rounded px-1 text-ink-muted hover:bg-panel-muted"
          >
            ✕
          </button>
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-auto p-2">
        {comments.length === 0 && (
          <li className="px-2 py-2 text-xs text-ink-muted">Aucun commentaire.</li>
        )}
        {comments.map((c) => {
          const author = nameOf.get(c.authorId);
          return (
            <li
              key={c.id}
              data-testid="comment-item"
              className="mb-2 rounded-md border border-line bg-panel-muted/40 p-2 text-sm"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: author?.color ?? "#94A3B8" }}
                  />
                  <span className="truncate font-medium text-ink">
                    {author?.name ?? c.authorId}
                  </span>
                  <span className="shrink-0 rounded bg-panel px-1 text-[9px] text-ink-muted">
                    {scopeLabel(c)}
                  </span>
                </span>
                {c.resolved ? (
                  <span className="shrink-0 text-[10px] text-emerald-400">résolu</span>
                ) : (
                  <button
                    type="button"
                    data-testid="resolve-comment"
                    onClick={() => resolve.mutate(c.id)}
                    className="shrink-0 text-[10px] text-accent hover:underline"
                  >
                    Résoudre
                  </button>
                )}
              </div>
              <p className="text-ink-muted">{c.body}</p>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-line p-2">
        <div className="mb-1 flex flex-wrap gap-1" role="radiogroup" aria-label="Portée du commentaire">
          {COMPOSER_SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={scope === s.value}
              disabled={!s.enabled}
              data-testid={`comment-scope-${s.value}`}
              onClick={() => setScope(s.value)}
              className={
                "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-40 " +
                (scope === s.value
                  ? "bg-accent/15 text-ink ring-1 ring-accent/40"
                  : "text-ink-muted hover:bg-panel-muted")
              }
            >
              {s.label}
            </button>
          ))}
        </div>
        <textarea
          data-testid="comment-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Votre commentaire…"
          className="mb-1 w-full rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink"
        />
        <button
          type="button"
          data-testid="comment-add"
          disabled={!body.trim()}
          onClick={submit}
          className="w-full rounded-md bg-accent/20 px-2 py-1 text-xs font-medium text-ink hover:bg-accent/30 disabled:opacity-40"
        >
          Commenter
        </button>
      </div>
    </aside>
  );
}
