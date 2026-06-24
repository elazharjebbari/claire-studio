/**
 * Bus d'interaction goldStore (sélection/survol/filtre, garde anti-fuite par document).
 */
import { afterEach, describe, expect, it } from "vitest";
import { useGoldStore } from "@/store/goldStore";

afterEach(() => {
  useGoldStore.setState({
    docKey: null,
    selectedIndex: null,
    hoverIndex: null,
    filter: "all",
    parkY: null,
  });
});

describe("useGoldStore", () => {
  it("init pose le document et réinitialise l'interaction", () => {
    const st = useGoldStore.getState();
    st.init("Atlas");
    st.select(3);
    st.hover(4);
    st.setFilter("conflicts");
    st.setParkY(120);
    expect(useGoldStore.getState().selectedIndex).toBe(3);

    // Changement de document → reset complet (pas de fuite).
    useGoldStore.getState().init("Academia");
    const s2 = useGoldStore.getState();
    expect(s2.docKey).toBe("Academia");
    expect(s2.selectedIndex).toBeNull();
    expect(s2.hoverIndex).toBeNull();
    expect(s2.filter).toBe("all");
    expect(s2.parkY).toBeNull();
  });

  it("init idempotent sur le même document (ne perd pas la sélection)", () => {
    const st = useGoldStore.getState();
    st.init("Atlas");
    st.select(5);
    useGoldStore.getState().init("Atlas");
    expect(useGoldStore.getState().selectedIndex).toBe(5);
  });
});
