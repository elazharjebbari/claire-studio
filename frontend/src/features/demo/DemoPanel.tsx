"use client";

/**
 * "Try the classifier": paste text, upload a .txt file, or pick one of the 17 held-out
 * CLAUDETTE contracts; then a job runs on the server and the result opens in `ResultsViewer`.
 * All strings are English (docs/pactiva-reviewer-demo/04b_contenus-en.md).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardPaste, FileText, Scale } from "lucide-react";

import { Button, Panel } from "@/components/ui/primitives";
import { listDemoContracts, type DemoContract } from "@/lib/api/demo";
import { estimateSentences, inputProblem, looksEnglish, MAX_CHARS, MAX_FILE_BYTES } from "./logic";
import { ResultsViewer } from "./ResultsViewer";
import { useDemoJob, type DemoErrorCode } from "./useDemoJob";

type Tab = "paste" | "upload" | "contract";

const ERROR_MESSAGES: Record<DemoErrorCode, string> = {
  empty: "Paste or upload some text first.",
  too_long: `This text exceeds ${MAX_CHARS.toLocaleString("en-GB")} characters. Please shorten it.`,
  not_english: "The classifier was trained on English contracts; please provide English text.",
  unknown_document: "This contract is not part of the held-out set.",
  access_code_required: "An access code is required for this demo.",
  queue_full: "Three requests are already waiting. Please try again in a minute.",
  throttled: "You have reached the hourly limit for this demo. The data and figures below remain available.",
  timeout: "The classification took too long and was stopped. Please try a shorter text.",
  model_unavailable: "The model is being installed on this server. Please try again shortly.",
  network: "The server could not be reached. Please check your connection and try again.",
  internal: "The classification could not be completed. Please try again.",
};

export interface DemoPanelProps {
  maxChars?: number;
  judgeIds?: string[];
}

export function DemoPanel({ maxChars = MAX_CHARS, judgeIds = ["fable", "claude", "codex", "mistral"] }: DemoPanelProps) {
  const [tab, setTab] = useState<Tab>("paste");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [contracts, setContracts] = useState<DemoContract[] | null>(null);
  const [contractsError, setContractsError] = useState(false);
  const [document, setDocument] = useState<string>("");
  const { state, submit, reset } = useDemoJob();
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (tab !== "contract" || contracts !== null) return;
    listDemoContracts()
      .then((r) => {
        setContracts(r.contracts);
        if (r.contracts[0]) setDocument((d) => d || r.contracts[0]!.document);
      })
      .catch(() => setContractsError(true));
  }, [tab, contracts]);

  useEffect(() => {
    if (state.phase === "done" && resultRef.current) {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      resultRef.current.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }
  }, [state.phase]);

  const problem = useMemo(() => inputProblem(text, maxChars), [text, maxChars]);
  const english = text.trim() ? looksEnglish(text) : null;
  const sentences = useMemo(() => estimateSentences(text), [text]);
  const busy = state.phase === "submitting" || state.phase === "queued" || state.phase === "running";
  const canSubmit = tab === "contract" ? Boolean(document) : problem === null;

  async function onFile(file: File | undefined) {
    setFileError(null);
    if (!file) return;
    if (!/\.txt$/i.test(file.name) && file.type && !file.type.startsWith("text/")) {
      setFileError("Plain text only (.txt).");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError("The file exceeds 200 KB.");
      return;
    }
    setText(await file.text());
    setFileName(file.name);
  }

  function onSubmit() {
    if (busy || !canSubmit) return;
    if (tab === "contract") void submit({ source: "contract", document });
    else void submit({ source: "text", text, title: fileName ?? "Pasted text" });
  }

  const statusLine =
    state.phase === "submitting" ? "Sending…"
    : state.phase === "queued" ? (state.position && state.position > 0 ? `Waiting in queue (position ${state.position})…` : "Loading the model…")
    : state.phase === "running" ? "Classifying sentences…"
    : null;

  const tabs: Array<{ id: Tab; label: string; icon: JSX.Element }> = [
    { id: "paste", label: "Paste text", icon: <ClipboardPaste size={14} aria-hidden /> },
    { id: "upload", label: "Upload a .txt file", icon: <FileText size={14} aria-hidden /> },
    { id: "contract", label: "CLAUDETTE contract (held out)", icon: <Scale size={14} aria-hidden /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Panel className="p-4 sm:p-6" data-testid="demo-panel">
        <div role="tablist" aria-label="Input" className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              id={`demo-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`demo-tabpanel-${t.id}`}
              data-testid={`demo-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium ${
                tab === t.id ? "border-accent bg-accent text-accent-fg" : "border-line bg-panel text-ink hover:bg-panel-muted"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div id={`demo-tabpanel-${tab}`} role="tabpanel" aria-labelledby={`demo-tab-${tab}`} className="mt-4">
          {tab === "paste" && (
            <label className="block">
              <span className="sr-only">Contract text</span>
              <textarea
                data-testid="demo-textarea"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setFileName(null);
                }}
                rows={10}
                maxLength={maxChars + 1000}
                placeholder={`Paste an English contract or terms of service (up to ${maxChars.toLocaleString("en-GB")} characters).`}
                aria-describedby="demo-counter"
                className="w-full resize-y rounded-md border border-line bg-bg p-3 font-reading text-[15px] leading-reading text-ink placeholder:text-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </label>
          )}

          {tab === "upload" && (
            <div className="flex flex-col gap-3">
              <label
                htmlFor="demo-file"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line bg-bg px-4 py-8 text-center text-sm text-ink-muted hover:bg-panel-muted"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void onFile(e.dataTransfer.files?.[0]);
                }}
              >
                <FileText size={20} aria-hidden />
                <span>{fileName ? `Selected: ${fileName}` : "Drop a .txt file here or click to choose one"}</span>
                <span className="text-[12px]">Plain text only (.txt, up to 200 KB). The file is read in your browser.</span>
                <input
                  id="demo-file"
                  data-testid="demo-file"
                  type="file"
                  accept=".txt,text/plain"
                  className="sr-only"
                  onChange={(e) => void onFile(e.target.files?.[0])}
                />
              </label>
              {fileError && <p className="text-sm text-danger" role="alert">{fileError}</p>}
              {fileName && text && (
                <pre className="max-h-32 overflow-auto rounded-md border border-line bg-bg p-3 text-[12px] text-ink-muted">
                  {text.split("\n").slice(0, 3).join("\n")}
                </pre>
              )}
            </div>
          )}

          {tab === "contract" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink-muted">
                These 17 contracts were held out from the design of the taxonomies and from the training of the model.
              </p>
              {contractsError && <p className="text-sm text-danger" role="alert">The list of contracts could not be loaded.</p>}
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-ink">Choose one of the 17 held-out contracts</span>
                <select
                  data-testid="demo-contract-select"
                  value={document}
                  onChange={(e) => setDocument(e.target.value)}
                  className="max-w-md rounded-md border border-line bg-bg px-3 py-2 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {(contracts ?? []).map((c) => (
                    <option key={c.document} value={c.document}>
                      {c.document} · {c.nSentences} sentences
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p id="demo-counter" aria-live="polite" className="text-[13px] text-ink-muted">
            {tab === "contract" ? (
              document ? `${document} · unseen by the model` : ""
            ) : (
              <>
                <span className={text.length > maxChars ? "text-danger" : ""}>{text.length.toLocaleString("en-GB")} / {maxChars.toLocaleString("en-GB")} characters</span>
                {" · "}about {sentences} sentences
                {english !== null && (english ? " · English ✓" : <span className="text-danger"> · Please paste English text</span>)}
              </>
            )}
          </p>
          <Button
            variant="primary"
            size="lg"
            data-testid="demo-classify"
            state={busy ? "pending" : state.phase === "failed" ? "error" : "idle"}
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            {busy ? "Classifying…" : state.phase === "failed" ? "Try again" : "Classify"}
          </Button>
        </div>

        <p className="mt-3 text-[12px] text-ink-muted">
          Legal-BERT (11 themes), trained on the 33 design contracts. Your text is processed once and not stored.
        </p>

        {statusLine && (
          <p role="status" aria-live="polite" data-testid="demo-status" className="mt-3 text-sm text-ink">
            {statusLine}
          </p>
        )}
        {state.phase === "failed" && state.error && (
          <p role="alert" data-testid="demo-error" className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-ink">
            {ERROR_MESSAGES[state.error]}
          </p>
        )}
      </Panel>

      <div ref={resultRef}>
        {state.phase === "done" && state.job?.result && (
          <ResultsViewer
            job={state.job}
            judgeIds={judgeIds}
            onClose={() => {
              reset();
            }}
          />
        )}
      </div>
    </div>
  );
}
