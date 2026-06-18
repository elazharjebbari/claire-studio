"use client";

/** Mode revue (F10) — lecture du document + notation + commentaires. */

import { useState } from "react";
import { useAnnotation, useDocument, useAddReview, useReviews } from "@/lib/api/hooks";
import { useUnfairnessIndex, unfairnessStyle } from "@/components/workspace/useUnfairness";
import { Panel, Button } from "@/components/ui/primitives";
import { ClauseChip } from "@/components/ui/ClauseChip";
import type { ReviewDecision } from "@/types/contract";

export default function ReviewPage({ params }: { params: { id: string } }) {
  const { data: annotation } = useAnnotation(params.id);
  const { data: doc } = useDocument(annotation?.documentId);
  const { data: reviews } = useReviews(params.id);
  const addReview = useAddReview(params.id);
  const unfair = useUnfairnessIndex(doc?.referenceLabels ?? []);

  const [score, setScore] = useState(4);
  const [decision, setDecision] = useState<ReviewDecision>("approve");
  const [body, setBody] = useState("");

  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-6 py-8 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="mb-3 text-xl font-semibold text-ink">Revue · {doc?.title}</h1>
        <Panel className="max-w-reading p-5 font-reading leading-reading">
          {doc?.sentences.map((s) => {
            const mark = unfair.get(s.index);
            return (
              <p key={s.id} className="py-0.5">
                <span className="mr-2 font-mono text-[11px] text-ink-muted">{s.index}</span>
                {mark ? (
                  <span className="unfairness-mark" style={unfairnessStyle(mark)}>
                    {s.rawText}
                  </span>
                ) : (
                  s.rawText
                )}
              </p>
            );
          })}
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel className="p-4">
          <h2 className="mb-2 font-semibold text-ink">Clauses annotées</h2>
          <div className="flex flex-col gap-1">
            {annotation?.clauses.map((c) => (
              <ClauseChip key={c.id} themeCode={c.theme} anchorIndex={c.anchorIndex} />
            ))}
          </div>
        </Panel>

        <Panel className="p-4">
          <h2 className="mb-2 font-semibold text-ink">Noter cette annotation</h2>
          <label className="flex items-center gap-2 text-sm text-ink">
            Score
            <input
              type="range"
              min={1}
              max={5}
              value={score}
              data-testid="review-score"
              onChange={(e) => setScore(Number(e.target.value))}
            />
            <span>{score}/5</span>
          </label>
          <select
            value={decision}
            data-testid="review-decision"
            onChange={(e) => setDecision(e.target.value as ReviewDecision)}
            className="mt-2 w-full rounded-md border border-line bg-panel-muted px-2 py-1 text-sm"
          >
            <option value="approve">Approuver</option>
            <option value="request_changes">Demander des changements</option>
            <option value="reject">Rejeter</option>
          </select>
          <textarea
            value={body}
            data-testid="review-body"
            onChange={(e) => setBody(e.target.value)}
            placeholder="Commentaire de revue…"
            rows={3}
            className="mt-2 w-full rounded-md border border-line bg-panel-muted px-2 py-1.5 text-sm"
          />
          <Button
            variant="primary"
            data-testid="review-submit"
            className="mt-2 w-full"
            onClick={() => addReview.mutate({ score, decision, body })}
          >
            Envoyer la revue
          </Button>
          {reviews && reviews.results.length > 0 && (
            <p className="mt-2 text-xs text-ink-muted">
              {reviews.results.length} revue(s) déjà enregistrée(s).
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
