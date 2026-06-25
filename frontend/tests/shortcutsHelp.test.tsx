import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShortcutsHelp } from "@/components/workspace/ShortcutsHelp";
import { useWorkspaceShortcuts } from "@/components/workspace/useShortcuts";
import { WORKSPACE_SHORTCUTS } from "@/lib/shortcuts";

function Harness({ onShowHelp }: { onShowHelp: () => void }) {
  useWorkspaceShortcuts({ onShowHelp });
  return null;
}

describe("L9 — aide raccourcis clavier", () => {
  it("registre : groupes non vides, chaque item a des touches + un libellé", () => {
    expect(WORKSPACE_SHORTCUTS.length).toBeGreaterThanOrEqual(3);
    for (const g of WORKSPACE_SHORTCUTS) {
      expect(g.items.length).toBeGreaterThan(0);
      for (const it of g.items) {
        expect(it.keys.length).toBeGreaterThan(0);
        expect(it.label).toBeTruthy();
      }
    }
  });

  it("la touche `?` déclenche l'aide", () => {
    const onShowHelp = vi.fn();
    render(<Harness onShowHelp={onShowHelp} />);
    fireEvent.keyDown(window, { key: "?" });
    expect(onShowHelp).toHaveBeenCalledTimes(1);
  });

  it("modale : role=dialog, liste tous les groupes, focus sur fermer", () => {
    render(<ShortcutsHelp onClose={() => {}} />);
    const dialog = screen.getByTestId("shortcuts-help");
    expect(dialog).toHaveAttribute("role", "dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    for (const g of WORKSPACE_SHORTCUTS) {
      expect(screen.getByTestId(`shortcuts-group-${g.title}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("shortcuts-help-close")).toHaveFocus();
  });

  it("Échap et le bouton ferment la modale", () => {
    const onClose = vi.fn();
    render(<ShortcutsHelp onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("shortcuts-help-close"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
