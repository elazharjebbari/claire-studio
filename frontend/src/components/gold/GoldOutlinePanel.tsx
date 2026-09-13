"use client";

/**
 * Sidebar de navigation GOLD (panneau gauche) — plan du document : stats d'avancement,
 * filtres (tout / conflits / non décidés), sauts conflit→conflit, et liste cliquable des
 * phrases (pastille de statut). Synchronisée avec les autres panneaux via le bus goldStore.
 */

import { useEffect, useRef } from "react";
import {
  ChevronUp,
  ChevronDown,
  Check,
  Sparkles,
  AlertTriangle,
  CircleDot,
  Circle,
  type LucideIcon,
} from "lucide-react";
import { useGoldStore, type GoldFilter } from "@/store/goldStore";
import { needsAttention, nextTodo, prevTodo, outlineStats } from "@/lib/gold/blocks";
import type { GoldSentenceRow } from "@/lib/gold/types";

/** Statut → icône de FORME distincte + classe + libellé (encodage non-couleur-seule, §B). */
function statusMeta(s: GoldSentenceRow): { Icon: LucideIcon; cls: string; label: string } {
  if (s.decided && s.autoResolved) return { Icon: Sparkles, cls: "text-info", label: "auto-résolu" };
  if (s.decided) return { Icon: Check, cls: "text-success", label: "décidé" };
  if (s.agreementClass === "divergence")
    return { Icon: AlertTriangle, cls: "text-danger", label: "conflit" };
  if (s.agreementClass === "majority") return { Icon: CircleDot, cls: "text-warning", label: "majorité" };
  return { Icon: Circle, cls: "text-ink-muted", label: "à trancher" };
}

const FILTERS: { key: GoldFilter; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "conflicts", label: "Conflits" },
  { key: "todo", label: "À trancher" },
];

export function GoldOutlinePanel({ sentences }: { sentences: GoldSentenceRow[] }) {
  const selectedIndex = useGoldStore((s) => s.selectedIndex);
  const filter = useGoldStore((s) => s.filter);
  const select = useGoldStore((s) => s.select);
  const hover = useGoldStore((s) => s.hover);
  const setFilter = useGoldStore((s) => s.setFilter);
  const setParkY = useGoldStore((s) => s.setParkY);
  const listRef = useRef<HTMLUListElement>(null);

  const stats = outlineStats(sentences);
  const visible = sentences.filter((s) => {
    if (filter === "conflicts") return needsAttention(s);
    if (filter === "todo") return !s.decided;
    return true;
  });

  function jump(dir: 1 | -1) {
    // Saut vers la FILE DE TRAVAIL (non décidées) et non vers les « conflits » : après
    // auto-résolution, la quasi-totalité des désaccords est déjà tranchée — sauter dessus
    // ferait traverser des milliers de phrases sans rien à y faire.
    const from = selectedIndex ?? (dir === 1 ? -1 : sentences.length);
    const target = dir === 1 ? nextTodo(sentences, from) : prevTodo(sentences, from);
    if (target != null) {
      setParkY(null); // navigation explicite = centrage simple (pas de curseur collant)
      select(target);
    }
  }

  // Garde la phrase sélectionnée visible dans le plan.
  useEffect(() => {
    if (selectedIndex == null) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-outline="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <div className="flex h-full flex-col" data-testid="gold-outline">
      <div className="border-b border-line p-3">
        <div className="mb-2 grid grid-cols-3 gap-1 text-center">
          <Stat n={stats.decided} total={stats.total} label="décidées" tone="text-success" />
          <Stat n={stats.pending} label="à trancher" tone="text-warning" />
          <Stat n={stats.ties} label="sans consensus" tone="text-danger" />
        </div>
        <div className="flex items-center gap-1">
          <div className="flex flex-1 rounded-md border border-line p-0.5" role="tablist">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                data-testid={`gold-filter-${f.key}`}
                onClick={() => setFilter(f.key)}
                className={`flex-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                  filter === f.key ? "bg-accent text-accent-fg" : "text-ink-muted hover:bg-panel-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Précédente à trancher (p)"
            title="Précédente à trancher — raccourci p"
            data-testid="gold-jump-prev"
            onClick={() => jump(-1)}
            className="rounded border border-line p-1 text-ink-muted hover:bg-panel-muted"
          >
            <ChevronUp size={14} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Suivante à trancher (n)"
            title="Suivante à trancher — raccourci n"
            data-testid="gold-jump-next"
            onClick={() => jump(1)}
            className="rounded border border-line p-1 text-ink-muted hover:bg-panel-muted"
          >
            <ChevronDown size={14} aria-hidden />
          </button>
        </div>
      </div>

      <ul ref={listRef} className="flex-1 overflow-y-auto p-1.5" data-testid="gold-outline-list">
        {visible.map((s) => {
          const selected = s.index === selectedIndex;
          const st = statusMeta(s);
          return (
            <li key={s.index} data-outline={s.index}>
              <button
                type="button"
                data-testid={`gold-outline-${s.index}`}
                aria-label={`Phrase ${s.index}, ${st.label}`}
                aria-current={selected ? "true" : undefined}
                onMouseEnter={() => hover(s.index)}
                onMouseLeave={() => hover(null)}
                onClick={() => {
                  setParkY(null);
                  select(s.index);
                }}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12px] transition-colors ${
                  selected ? "bg-panel-muted ring-1 ring-accent/40" : "hover:bg-panel-muted/60"
                }`}
              >
                <st.Icon size={12} className={`shrink-0 ${st.cls}`} aria-hidden />
                <span className="w-5 shrink-0 font-mono text-[10px] text-ink-muted">{s.index}</span>
                <span className="min-w-0 flex-1 truncate text-ink">
                  {s.decided ? s.primary : s.proposedPrimary || "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stat({ n, total, label, tone }: { n: number; total?: number; label: string; tone: string }) {
  return (
    <div className="rounded-md bg-panel-muted/50 py-1">
      <div className={`text-sm font-semibold ${tone}`}>{total != null ? `${n}/${total}` : n}</div>
      <div className="text-[9px] uppercase tracking-wide text-ink-muted">{label}</div>
    </div>
  );
}
