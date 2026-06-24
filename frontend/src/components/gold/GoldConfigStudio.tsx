"use client";

/**
 * Studio de config de campagne de résolution (admin/lead) — paramètre AVANT/PENDANT la
 * campagne : qui peut arbitrer (autocomplétion nominative), rôle/poids des LLM, auto-
 * résolution, partage des arbitrages, politique des secondaires. Gelé si projet verrouillé.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Gavel, Save, Lock, Users, Bot, Sparkles } from "lucide-react";
import { useGoldConfig, useMembers, useProject, useSaveGoldConfig } from "@/lib/api/hooks";
import { useUiStore } from "@/store/ui";
import { Button, Panel } from "@/components/ui/primitives";
import { ArbiterPicker } from "./ArbiterPicker";
import type { ResolutionConfig } from "@/lib/gold/types";

const SECONDARY_POLICIES: { value: ResolutionConfig["secondaryPolicy"]; label: string }[] = [
  { value: "advisory", label: "Indicatif" },
  { value: "optional", label: "Optionnel" },
  { value: "required", label: "Requis" },
];

function Toggle({
  on,
  onClick,
  disabled,
  testid,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  testid?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      data-testid={testid}
      onClick={onClick}
      className={`inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
        on ? "bg-success" : "bg-panel-muted"
      }`}
    >
      <span className={`h-4 w-4 rounded-full bg-panel transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

function Section({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <Panel className="p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
        {icon}
        {title}
      </div>
      {desc && <p className="mb-3 text-[12px] text-ink-muted">{desc}</p>}
      {children}
    </Panel>
  );
}

export function GoldConfigStudio({ slug, embedded = false }: { slug: string; embedded?: boolean }) {
  const setProject = useUiStore((s) => s.setCurrentProject);
  useEffect(() => setProject(slug), [slug, setProject]);

  const { data: config } = useGoldConfig(slug);
  const { data: members } = useMembers(slug);
  const { data: project } = useProject(slug);
  const save = useSaveGoldConfig(slug);

  const [draft, setDraft] = useState<ResolutionConfig | null>(null);
  useEffect(() => {
    if (config) setDraft(config);
  }, [config]);

  const locked = !!project?.locked;
  const dirty = useMemo(
    () => !!draft && !!config && JSON.stringify(draft) !== JSON.stringify(config),
    [draft, config],
  );

  if (!draft) return <div className={embedded ? "py-4 text-ink-muted" : "px-6 py-8 text-ink-muted"}>Chargement de la configuration…</div>;

  const patch = (p: Partial<ResolutionConfig>) => setDraft({ ...draft, ...p });

  return (
    <div className={embedded ? "" : "mx-auto max-w-3xl px-6 py-8"} data-testid="gold-config">
      {!embedded && (
        <>
          <Link href={`/projects/${slug}/gold`} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
            <ChevronLeft size={15} aria-hidden /> Cockpit
          </Link>
          <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-ink">
            <Gavel size={18} className="text-gold" aria-hidden /> Configuration de la résolution
          </h1>
          <p className="mb-5 text-sm text-ink-muted">
            Réglez l'arbitrage inter-annotateurs : qui arbitre, l'auto-résolution, le partage.
          </p>
        </>
      )}

      {locked && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] text-warning" data-testid="gold-config-locked">
          <Lock size={13} aria-hidden /> Projet verrouillé : configuration en lecture seule.
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* ARBITRES — pièce centrale (autocomplétion) */}
        <Section
          icon={<Users size={15} className="text-gold" aria-hidden />}
          title="Qui peut arbitrer"
          desc="Ajoutez nominativement les membres autorisés à trancher le gold. Vide = politique par défaut (leads et reviewers). Admins et leads gardent toujours l'accès."
        >
          <ArbiterPicker
            members={members?.results ?? []}
            value={draft.arbiters}
            onChange={(arbiters) => patch({ arbiters })}
            disabled={locked}
          />
        </Section>

        {/* Modèles — RÉFÉRENCE seulement */}
        <Section
          icon={<Bot size={15} aria-hidden />}
          title="Modèles LLM"
          desc="Les modèles (claude/codex/mistral) sont affichés en RÉFÉRENCE dans l'atelier mais n'entrent JAMAIS dans la décision : la résolution reste strictement entre annotateurs."
        >
          <div className="rounded-md border border-line bg-panel-muted/40 px-3 py-2 text-[12px] text-ink-muted">
            Aucun réglage : un désaccord avec un modèle n'est jamais un conflit.
          </div>
        </Section>

        {/* Auto-résolution (annotateurs seuls) */}
        <Section icon={<Sparkles size={15} aria-hidden />} title="Auto-résolution" desc="Trancher automatiquement les accords entre annotateurs pour ne garder que les vrais conflits.">
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-ink">Accord strict des annotateurs → 1 clic (auto)</span>
            <Toggle
              testid="config-absolute"
              disabled={locked}
              on={draft.autoResolve.absoluteAgreement}
              onClick={() => patch({ autoResolve: { ...draft.autoResolve, absoluteAgreement: !draft.autoResolve.absoluteAgreement } })}
            />
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-ink">Majorité d'annotateurs ≥ 2/3 → auto</span>
            <Toggle
              testid="config-majority"
              disabled={locked}
              on={draft.autoResolve.majority}
              onClick={() => patch({ autoResolve: { ...draft.autoResolve, majority: !draft.autoResolve.majority } })}
            />
          </div>
        </Section>

        {/* Partage + secondaires */}
        <Section icon={<Gavel size={15} aria-hidden />} title="Arbitrage & secondaires">
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-ink">Partage automatique des arbitrages (révocable)</span>
            <Toggle
              testid="config-autoshare"
              disabled={locked}
              on={draft.autoShare}
              onClick={() => patch({ autoShare: !draft.autoShare })}
            />
          </div>
          <label className="mt-2 flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Politique des secondaires</span>
            <select
              data-testid="config-secondary"
              disabled={locked}
              value={draft.secondaryPolicy}
              onChange={(e) => patch({ secondaryPolicy: e.target.value as ResolutionConfig["secondaryPolicy"] })}
              className="w-48 rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink"
            >
              {SECONDARY_POLICIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
        </Section>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button
          variant="primary"
          data-testid="gold-config-save"
          disabled={locked || !dirty || save.isPending}
          onClick={() => save.mutate(draft)}
        >
          <Save size={14} aria-hidden /> {save.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        {save.isSuccess && !dirty && (
          <span className="text-[12px] text-success" data-testid="gold-config-saved">Configuration enregistrée.</span>
        )}
      </div>
    </div>
  );
}
