"use client";

/** Préférences perso : thème, densité, raccourcis (navigation.md §1). Persistées. */

import { useUiStore } from "@/store/ui";
import { Panel } from "@/components/ui/primitives";

const SHORTCUTS: Array<[string, string]> = [
  ["j / k", "Phrase suivante / précédente"],
  ["B", "Poser une frontière de clause"],
  ["T", "Cibler le sélecteur de thème"],
  ["C", "Ouvrir un commentaire"],
  ["0–3", "Certitude de la clause sélectionnée"],
  ["⌘S", "Snapshot (version)"],
  ["⌘K", "Palette de commandes"],
];

export default function SettingsPage() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const density = useUiStore((s) => s.density);
  const setDensity = useUiStore((s) => s.setDensity);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-4 text-xl font-semibold text-ink">Préférences</h1>

      <Panel className="mb-4 p-4">
        <h2 className="mb-2 font-semibold text-ink">Affichage</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            Thème
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as "dark" | "light")}
              className="rounded-md border border-line bg-panel-muted px-2 py-1"
            >
              <option value="dark">Sombre (anti-fatigue)</option>
              <option value="light">Clair</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            Densité
            <select
              value={density}
              onChange={(e) => setDensity(e.target.value as "comfortable" | "compact")}
              className="rounded-md border border-line bg-panel-muted px-2 py-1"
            >
              <option value="comfortable">Confortable</option>
              <option value="compact">Compacte</option>
            </select>
          </label>
        </div>
      </Panel>

      <Panel className="p-4">
        <h2 className="mb-2 font-semibold text-ink">Raccourcis clavier</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <kbd className="rounded bg-panel-muted px-2 py-0.5 font-mono text-xs text-ink">
                {k}
              </kbd>
              <span className="text-ink-muted">{v}</span>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}
