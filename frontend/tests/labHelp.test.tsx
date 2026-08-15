/**
 * Aide du Lab (lot L5) : modale « Lire une page de résultats » (patron GoldHelpModal,
 * a11y) + pages du centre d'aide enregistrées + lien profond `?s=`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LabHelpModal } from "@/features/lab/LabHelpModal";
import { HELP_MANIFEST, helpSection } from "../content/help/manifest";
import { helpContent } from "../content/help";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LabHelpModal", () => {
  it("est une modale accessible qui porte les quatre principes de lecture", () => {
    render(<LabHelpModal onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("lab-help-ci").textContent).toMatch(/jamais nu/);
    expect(screen.getByTestId("lab-help-ceiling").textContent).toMatch(/repère, pas un adversaire/);
    expect(screen.getByTestId("lab-help-paired").textContent).toMatch(/mêmes plis/);
    expect(screen.getByTestId("lab-help-exploratory").textContent).toMatch(/s'assume/);
  });

  it("Échap ferme la modale (a11y, patron GoldHelpModal)", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<LabHelpModal onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("relie vers les deux pages longues du centre d'aide", () => {
    render(<LabHelpModal onClose={() => {}} />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/help?s=lab-metriques");
    expect(hrefs).toContain("/help?s=lab-experiences");
  });
});

describe("centre d'aide — pages Lab", () => {
  it("⭐ les deux pages sont enregistrées : manifeste + contenu (l'un sans l'autre = section introuvable)", () => {
    for (const slug of ["lab-experiences", "lab-metriques"]) {
      expect(helpSection(slug), slug).toBeDefined();
      expect(helpSection(slug)!.group).toBe("Lab");
      expect(helpContent(slug), slug).toBeTruthy();
    }
  });

  it("le contenu métriques couvre l'essentiel du glossaire, en version longue", () => {
    const content = helpContent("lab-metriques")!;
    for (const term of ["macro-F1", "micro-F1", "kappa", "LRAP", "WindowDiff", "ECE",
      "bootstrap par document", "Plafond humain"]) {
      expect(content, term).toContain(term);
    }
  });

  it("le parcours raconte l'ordre recommandé (criblage avant GPU)", () => {
    const content = helpContent("lab-experiences")!;
    expect(content.indexOf("baseline-fast")).toBeGreaterThan(-1);
    expect(content.indexOf("screening-preprocess")).toBeLessThan(
      content.indexOf("legal-bert-finetune"),
    );
  });

  it("aucun slug du manifeste sans contenu (garde générale, y compris les nouveaux)", () => {
    for (const section of HELP_MANIFEST) {
      expect(helpContent(section.slug), section.slug).toBeTruthy();
    }
  });
});
