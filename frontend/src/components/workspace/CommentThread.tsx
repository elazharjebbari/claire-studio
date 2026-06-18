"use client";

/** Fil de commentaires ancré (F9) — affiché dans l'inspecteur. */

import { useState } from "react";
import { useAddComment, useComments, useResolveComment } from "@/lib/api/hooks";
import { Button } from "@/components/ui/primitives";

export function CommentThread({
  annotationId,
  clauseId,
}: {
  annotationId: string;
  clauseId?: string;
}) {
  const { data } = useComments(annotationId);
  const addComment = useAddComment(annotationId);
  const resolve = useResolveComment(annotationId);
  const [draft, setDraft] = useState("");

  const comments = (data?.results ?? []).filter(
    (c) => !clauseId || c.clauseId === clauseId,
  );

  return (
    <div className="flex flex-col gap-2" data-testid="comment-thread">
      <ul className="flex flex-col gap-2">
        {comments.map((c) => (
          <li
            key={c.id}
            className="rounded-md border border-line bg-panel-muted p-2 text-sm"
            data-testid="comment-item"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink">{c.authorId}</span>
              {c.resolved ? (
                <span className="text-[11px] text-emerald-400">résolu</span>
              ) : (
                <button
                  type="button"
                  data-testid="resolve-comment"
                  onClick={() => resolve.mutate(c.id)}
                  className="text-[11px] text-accent hover:underline"
                >
                  Résoudre
                </button>
              )}
            </div>
            <p className="text-ink-muted">{c.body}</p>
          </li>
        ))}
        {comments.length === 0 && (
          <li className="text-xs text-ink-muted">Aucun commentaire sur cette clause.</li>
        )}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          addComment.mutate({ body: draft.trim(), clauseId });
          setDraft("");
        }}
        className="flex flex-col gap-1"
      >
        <label htmlFor="comment-input" className="sr-only">
          Nouveau commentaire
        </label>
        <textarea
          id="comment-input"
          data-testid="comment-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Justifier ce choix…"
          rows={2}
          className="rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink"
        />
        <Button type="submit" variant="subtle" data-testid="comment-submit">
          Commenter
        </Button>
      </form>
    </div>
  );
}
