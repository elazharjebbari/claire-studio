/**
 * Traduction des clauses dans l'atelier de résolution GOLD — bascule VO / Bilingue / FR.
 *
 * Le corpus CLAUDETTE est en anglais et fait foi juridiquement, mais les arbitres
 * travaillent en français : la bascule doit être immédiate, lisible dans les DEUX panneaux
 * (lecture et inspecteur), et ne jamais laisser un trou dans le contrat quand une phrase
 * n'est pas traduite.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { GoldReadingPanel } from "@/components/gold/GoldReadingPanel";
import { GoldInspectorPanel } from "@/components/gold/GoldInspectorPanel";
import { LangSwitch } from "@/components/workspace/LangSwitch";
import { useGoldStore } from "@/store/goldStore";
import type { GoldSentenceRow } from "@/lib/gold/types";

afterEach(() => cleanup());

const VO = "We may terminate your account at any time.";
const FR = "Nous pouvons résilier votre compte à tout moment.";

function row(over: Partial<GoldSentenceRow> = {}): GoldSentenceRow {
  return {
    index: 0,
    text: VO,
    textFr: FR,
    annotators: [],
    llms: [],
    agreementClass: "divergence",
    riskBand: "high",
    autoLevel: "manual",
    confidence: 0.33,
    humanDissent: false,
    proposedPrimary: "TERMINATION",
    proposedSecondaries: [],
    tie: true,
    nCovering: 3,
    decided: false,
    autoResolved: false,
    primary: "",
    secondaries: [],
    decidedBy: null,
    decidedByName: "",
    comment: "",
    ...over,
  } as GoldSentenceRow;
}

describe("Panneau de lecture GOLD — langue", () => {
  it("VO : le texte original seul", () => {
    render(
      <GoldReadingPanel sentences={[row()]} displayLang="orig" canDecide={false} onValidate={vi.fn()} />,
    );
    expect(screen.getByTestId("gold-row-0")).toHaveTextContent(VO);
    expect(screen.queryByTestId("gold-translation-0")).not.toBeInTheDocument();
  });

  it("⭐ Bilingue : la traduction s'ajoute SOUS l'original (le texte qui fait foi reste visible)", () => {
    render(
      <GoldReadingPanel sentences={[row()]} displayLang="both" canDecide={false} onValidate={vi.fn()} />,
    );
    const line = screen.getByTestId("gold-row-0");
    expect(line).toHaveTextContent(VO);
    expect(screen.getByTestId("gold-translation-0")).toHaveTextContent(FR);
  });

  it("⭐ FR : la traduction REMPLACE l'original", () => {
    render(
      <GoldReadingPanel sentences={[row()]} displayLang="fr" canDecide={false} onValidate={vi.fn()} />,
    );
    const line = screen.getByTestId("gold-row-0");
    expect(line).toHaveTextContent(FR);
    expect(line).not.toHaveTextContent(VO);
  });

  it("⭐ FR sans traduction : repli sur la VO + mention explicite (jamais de trou)", () => {
    render(
      <GoldReadingPanel
        sentences={[row({ textFr: undefined })]}
        displayLang="fr"
        canDecide={false}
        onValidate={vi.fn()}
      />,
    );
    const line = screen.getByTestId("gold-row-0");
    expect(line).toHaveTextContent(VO);
    expect(line).toHaveTextContent("non traduite");
  });
});

describe("Inspecteur GOLD — langue", () => {
  it("affiche la clause dans la langue choisie", () => {
    const { rerender } = render(
      <GoldInspectorPanel sentence={row()} displayLang="fr" canDecide={false} pending={false} onDecide={vi.fn()} />,
    );
    expect(screen.getByTestId("gold-inspector")).toHaveTextContent(FR);

    rerender(
      <GoldInspectorPanel sentence={row()} displayLang="both" canDecide={false} pending={false} onDecide={vi.fn()} />,
    );
    expect(screen.getByTestId("gold-inspector-translation")).toHaveTextContent(FR);
    expect(screen.getByTestId("gold-inspector")).toHaveTextContent(VO);
  });
});

describe("Bascule de langue", () => {
  it("⭐ trois états, accessibles au clavier (flèches) et annoncés en radiogroup", () => {
    const onChange = vi.fn();
    render(<LangSwitch value="orig" onChange={onChange} testIdPrefix="gold-lang" />);
    const group = screen.getByTestId("gold-lang-switch");
    expect(group).toHaveAttribute("role", "radiogroup");
    expect(screen.getByTestId("gold-lang-orig")).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByTestId("gold-lang-fr"));
    expect(onChange).toHaveBeenCalledWith("fr");

    fireEvent.keyDown(screen.getByTestId("gold-lang-orig"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("both");
  });

  it("préfixe de testid : les deux ateliers peuvent coexister sans collision", () => {
    render(
      <>
        <LangSwitch value="orig" onChange={vi.fn()} />
        <LangSwitch value="fr" onChange={vi.fn()} testIdPrefix="gold-lang" />
      </>,
    );
    expect(screen.getByTestId("lang-switch")).toBeInTheDocument();
    expect(screen.getByTestId("gold-lang-switch")).toBeInTheDocument();
  });
});

describe("Store GOLD — la langue est un réglage de LECTURE", () => {
  it("⭐ changer de document ne réinitialise PAS la langue choisie", () => {
    const store = useGoldStore.getState();
    store.init("9gag");
    store.setDisplayLang("fr");
    store.select(12);

    useGoldStore.getState().init("Academia"); // document suivant
    const next = useGoldStore.getState();
    expect(next.selectedIndex).toBeNull(); // l'état d'interaction est bien remis à zéro…
    expect(next.displayLang).toBe("fr"); // …mais pas la langue de lecture
  });
});
