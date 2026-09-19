/**
 * Reviewer demo — panel and viewer with a mocked API: guards, job lifecycle, result rendering.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { DemoJob } from "@/lib/api/demo";

const api = vi.hoisted(() => ({
  listDemoContracts: vi.fn(),
  startClassification: vi.fn(),
  getDemoJob: vi.fn(),
  getDemoManifest: vi.fn(),
}));

vi.mock("@/lib/api/demo", () => api);

import { DemoPanel } from "@/features/demo/DemoPanel";
import { ResultsViewer } from "@/features/demo/ResultsViewer";

const ENGLISH = "We may terminate your account at any time without notice. All fees are due within thirty days and are not refundable.";

function doneJob(overrides: Partial<DemoJob> = {}): DemoJob {
  return {
    jobId: "j1",
    status: "done",
    source: "text",
    document: null,
    title: "Pasted text",
    timings: { queuedS: 0.1, runS: 2.3 },
    error: null,
    result: {
      segmenter: "pysbd",
      classes: ["TERMINATION", "FEES_PAYMENT"],
      truncated: false,
      sentences: [
        { index: 0, text: "We may terminate your account at any time without notice.", label: "TERMINATION", confidence: 0.93, scores: {} },
        { index: 1, text: "All fees are due within thirty days and are not refundable.", label: "FEES_PAYMENT", confidence: 0.81, scores: {} },
      ],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  api.listDemoContracts.mockResolvedValue({ contracts: [{ document: "Headspace", nSentences: 212, nUnfair: 40 }] });
  api.startClassification.mockResolvedValue({ jobId: "j1", status: "queued", position: 0 });
  api.getDemoJob.mockResolvedValue(doneJob());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("DemoPanel", () => {
  it("keeps Classify disabled until English text is pasted", () => {
    render(<DemoPanel />);
    const button = screen.getByTestId("demo-classify");
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByTestId("demo-textarea"), { target: { value: "Ceci est du texte en français seulement." } });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Please paste English text/)).toBeTruthy();
    fireEvent.change(screen.getByTestId("demo-textarea"), { target: { value: ENGLISH } });
    expect(button).not.toBeDisabled();
    expect(screen.getByText(/English ✓/)).toBeTruthy();
  });

  it("refuses a text longer than the limit", () => {
    render(<DemoPanel maxChars={50} />);
    fireEvent.change(screen.getByTestId("demo-textarea"), { target: { value: ENGLISH } });
    expect(screen.getByTestId("demo-classify")).toBeDisabled();
  });

  it("runs a job and shows the result with segments", async () => {
    render(<DemoPanel />);
    fireEvent.change(screen.getByTestId("demo-textarea"), { target: { value: ENGLISH } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("demo-classify"));
    });
    expect(api.startClassification).toHaveBeenCalledWith({ source: "text", text: ENGLISH, title: "Pasted text" }, undefined);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    await waitFor(() => expect(screen.getByTestId("demo-result")).toBeTruthy());
    expect(screen.getAllByTestId("demo-sentence-row")).toHaveLength(2);
    expect(screen.getAllByTestId("demo-boundary")).toHaveLength(2);
    expect(screen.getByTestId("demo-summary").textContent).toMatch(/2 sentences · 2 thematic segments/);
  });

  it("lists the held-out contracts and sends the chosen one", async () => {
    render(<DemoPanel />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("demo-tab-contract"));
    });
    await waitFor(() => expect(screen.getByTestId("demo-contract-select")).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/Headspace · 212 sentences/)).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByTestId("demo-classify"));
    });
    expect(api.startClassification).toHaveBeenCalledWith({ source: "contract", document: "Headspace" }, undefined);
  });

  it("turns a 429 into the quota message", async () => {
    const { ApiError } = await import("@/lib/api/client");
    api.startClassification.mockRejectedValue(new ApiError(429, "throttled", { detail: "Request was throttled." }));
    render(<DemoPanel />);
    fireEvent.change(screen.getByTestId("demo-textarea"), { target: { value: ENGLISH } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("demo-classify"));
    });
    await waitFor(() => expect(screen.getByTestId("demo-error").textContent).toMatch(/hourly limit/));
    expect(screen.getByTestId("demo-classify").textContent).toMatch(/Try again/);
  });
});

describe("ResultsViewer (held-out contract)", () => {
  const job = doneJob({
    source: "contract",
    document: "Headspace",
    title: "Headspace",
    result: {
      segmenter: "provided",
      classes: [],
      truncated: false,
      sentences: [
        { index: 0, text: "Welcome.", label: "FRAMEWORK", confidence: 0.9, scores: {} },
        { index: 1, text: "We may terminate.", label: "TERMINATION", confidence: 0.8, scores: {} },
      ],
      comparison: {
        gold: [
          { index: 0, primaryT20: "PREAMBLE_SCOPE", primaryT11: "FRAMEWORK", agreementClass: "strict", tier: "auto_1click", secondaries: [] },
          { index: 1, primaryT20: "ACCEPTABLE_USE", primaryT11: "ACCOUNT_USE", agreementClass: "majority", tier: "auto", secondaries: [] },
        ],
        votes: [
          { index: 0, A1: "PREAMBLE_SCOPE", A2: "PREAMBLE_SCOPE", A3: "PREAMBLE_SCOPE" },
          { index: 1, A1: "ACCEPTABLE_USE", A2: "ACCEPTABLE_USE", A3: "TERMINATION" },
        ],
        judges: [{ index: 0, fable: "PREAMBLE_SCOPE" }, { index: 1, fable: "TERMINATION" }],
        summary: { nSentences: 2, accuracyT11: 0.5, kappaT11: 0.0, judgesAccuracyT11: { fable: 0.5 } },
        judgesLegend: { fable: "Claude Fable 5" },
      },
    },
  });

  it("shows the summary, reference columns, and filters disagreements", () => {
    render(<ResultsViewer job={job} judgeIds={["fable"]} />);
    expect(screen.getByTestId("demo-summary").textContent).toMatch(/Accuracy against the gold standard 0.50 · Cohen's κ 0.00/);
    expect(screen.getByTestId("demo-gold-1").getAttribute("aria-label")).toMatch(/Account access and use/);
    expect(screen.getByTestId("demo-gold-1").textContent).toBe("≠");
    expect(screen.getAllByTestId("demo-sentence-row")).toHaveLength(2);
    fireEvent.click(screen.getByTestId("demo-disagreements"));
    expect(screen.getAllByTestId("demo-sentence-row")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("demo-taxonomy-T20"));
    expect(screen.getByTestId("demo-gold-1").getAttribute("aria-label")).toMatch(/Acceptable use/);
    expect(screen.getByText(/Exports omit the sentence text/)).toBeTruthy();
  });
});
