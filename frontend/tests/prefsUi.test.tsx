import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { PrefSwitch } from "@/components/ui/PrefSwitch";
import { AutoPrefillConsentDialog } from "@/components/workspace/AutoPrefillConsentDialog";
import { PreferencesPopover } from "@/components/workspace/PreferencesPopover";
import { usePrefsStore } from "@/store/prefs";
import { UI_PREFS_DEFAULTS } from "@/lib/prefs/schema";

beforeEach(() => {
  window.localStorage.clear();
  usePrefsStore.setState({ uid: "u1", prefs: UI_PREFS_DEFAULTS, rev: 0, syncStatus: "idle" });
});
afterEach(cleanup);

describe("PrefSwitch", () => {
  it("est un role=switch reflétant aria-checked et bascule au clic", () => {
    const onChange = vi.fn();
    const { rerender } = render(<PrefSwitch checked={false} label="X" onChange={onChange} data-testid="sw" />);
    const sw = screen.getByTestId("sw");
    expect(sw).toHaveAttribute("role", "switch");
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(<PrefSwitch checked label="X" onChange={onChange} data-testid="sw" />);
    expect(screen.getByTestId("sw")).toHaveAttribute("aria-checked", "true");
  });

  it("désactivé : ne déclenche pas onChange", () => {
    const onChange = vi.fn();
    render(<PrefSwitch checked={false} disabled label="X" onChange={onChange} data-testid="sw" />);
    fireEvent.click(screen.getByTestId("sw"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("AutoPrefillConsentDialog", () => {
  it("affiche le modèle et déclenche activer/refuser", () => {
    const onActivate = vi.fn();
    const onDecline = vi.fn();
    render(<AutoPrefillConsentDialog judge="mistral" onActivate={onActivate} onDecline={onDecline} />);
    expect(screen.getByTestId("auto-prefill-consent")).toHaveTextContent("Mistral");
    fireEvent.click(screen.getByTestId("auto-prefill-activate"));
    expect(onActivate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("auto-prefill-decline"));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });
});

describe("PreferencesPopover (branché sur le store de prefs)", () => {
  it("ouvre, arme un modèle d'auto-prefill et bascule un panneau", () => {
    render(<PreferencesPopover />);
    fireEvent.click(screen.getByTestId("prefs-toggle"));
    expect(screen.getByTestId("prefs-card")).toBeInTheDocument();

    // Armer Mistral → judge posé, et activable.
    fireEvent.click(screen.getByTestId("prefs-autoprefill-model-mistral"));
    expect(usePrefsStore.getState().prefs.prefill.judge).toBe("mistral");

    // Replier l'inspecteur via le switch du popover.
    fireEvent.click(screen.getByTestId("prefs-panel-inspectorOpen"));
    expect(usePrefsStore.getState().prefs.panels.inspectorOpen).toBe(false);
  });

  it("réinitialise les préférences", () => {
    usePrefsStore.getState().setPrefill({ enabled: true, judge: "claude" });
    render(<PreferencesPopover />);
    fireEvent.click(screen.getByTestId("prefs-toggle"));
    fireEvent.click(screen.getByTestId("prefs-reset"));
    expect(usePrefsStore.getState().prefs).toEqual(UI_PREFS_DEFAULTS);
  });
});
