"use client";

/**
 * Studio de config de campagne de résolution (admin/lead) — paramètre AVANT/PENDANT la
 * campagne : qui peut arbitrer (autocomplétion nominative), rôle/poids des LLM, auto-
 * résolution, partage des arbitrages, politique des secondaires. Gelé si projet verrouillé.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Gavel, Save, Lock, Users, Bot, Sparkles, UserPlus, UserMinus, RefreshCw } from "lucide-react";
import {
  useGoldConfig,
  useMembers,
  useProject,
  useSaveGoldConfig,
  useRecomputeGoldProject,
  useGoldLlmAnnotators,
  useMutateGoldLlmAnnotator,
} from "@/lib/api/hooks";
import { useUiStore } from "@/store/ui";
import { Button, Panel } from "@/components/ui/primitives";
import { ArbiterPicker } from "./ArbiterPicker";
import type { ResolutionConfig } from "@/lib/gold/types";

const SECONDARY_POLICIES: {
  value: ResolutionConfig["secondaryPolicy"];
  label: string;
  effect: string;
}[] = [
  {
    value: "advisory",
    label: "Indicatif — gold mono-étiquette",
    effect:
      "Les secondaires sont affichés à l'arbitre mais n'entrent JAMAIS dans le gold auto-résolu, même quand tous les annotateurs portent le même. Seules les phrases arbitrées à la main peuvent en garder.",
  },
  {
    value: "optional",
    label: "Optionnel — gold mono-étiquette",
    effect:
      "Identique à « indicatif » pour l'auto-résolution : aucune promotion d'office.",
  },
  {
    value: "required",
    label: "Requis — gold multi-étiquettes",
    effect:
      "Les secondaires consensuels (portés par au moins deux annotateurs) entrent dans le gold auto-résolu. C'est le réglage cohérent avec une ressource multi-étiquettes.",
  },
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
  const recompute = useRecomputeGoldProject(slug);

  const [draft, setDraft] = useState<ResolutionConfig | null>(null);
  useEffect(() => {
    if (config) setDraft(config);
  }, [config]);

  const locked = !!project?.locked;
  // Mesure d'impact : lue du serveur, JAMAIS du brouillon (elle décrit l'état actuel du
  // gold, pas ce que le brouillon produirait).
  const impact = config?.secondaryImpact;
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

        {/* PARTICIPANTS ATTENDUS — la porte de sortie quand la campagne dévie (un lead a
            annoté, un assigné n'a jamais participé). Le garde-fou de complétude reste actif. */}
        <Section
          icon={<Users size={15} aria-hidden />}
          title="Participants attendus"
          desc="Qui doit avoir soumis pour qu'un document devienne arbitrable. Vide = déduit des assignations. Déclarez la liste réelle si un annotateur assigné ne participera pas, ou si un lead a annoté : la résolution reste bloquée tant que TOUS les participants déclarés n'ont pas soumis."
        >
          <ArbiterPicker
            members={members?.results ?? []}
            value={draft.expectedAnnotators ?? []}
            onChange={(expectedAnnotators) => patch({ expectedAnnotators })}
            disabled={locked}
            testIdPrefix="participant"
            placeholder="Ajouter un participant attendu…"
          />
        </Section>

        {/* Comptes annotateurs dérivés des LLM (ajout/retrait) */}
        <LlmAnnotatorsSection slug={slug} locked={locked} />

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
            <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Politique des secondaires
            </span>
            <select
              data-testid="config-secondary"
              disabled={locked}
              value={draft.secondaryPolicy}
              onChange={(e) =>
                patch({ secondaryPolicy: e.target.value as ResolutionConfig["secondaryPolicy"] })
              }
              className="w-full max-w-md rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink"
            >
              {SECONDARY_POLICIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="text-[12px] text-ink-muted" data-testid="config-secondary-effect">
              {SECONDARY_POLICIES.find((p) => p.value === draft.secondaryPolicy)?.effect}
            </span>
          </label>

          {/* IMPACT MESURÉ : sans ce chiffre, le réglage est un menu opaque et la décision
              de protocole se prend à l'aveugle. */}
          {impact && (
            <div
              data-testid="config-secondary-impact"
              className="mt-2 rounded-md border border-line bg-panel-muted/40 px-3 py-2 text-[12px] text-ink-muted"
            >
              <p>
                Sur ce projet, <strong className="text-ink">{impact.sentencesWithProposed}</strong>{" "}
                phrase(s) portent des secondaires consensuels (
                <strong className="text-ink">{impact.proposedLabels}</strong> étiquette(s)) ;{" "}
                <strong className="text-ink">{impact.sentencesCarrying}</strong> les ont
                réellement dans le gold.
              </p>
              {impact.documentsFinalized > 0 && (
                <p className="mt-1 text-warning">
                  {impact.documentsFinalized} document(s) sont déjà figés : un changement de
                  politique n'aura plus aucun effet sur eux.
                </p>
              )}
            </div>
          )}

          {/* APPLICATION : changer la politique ne réécrit rien tant que les documents déjà
              matérialisés ne sont pas recalculés. Sans ce bouton, le réglage semble sans effet. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              data-testid="gold-recompute-all"
              disabled={locked || dirty || recompute.isPending}
              loading={recompute.isPending}
              onClick={() => recompute.mutate()}
              title={
                dirty
                  ? "Enregistrez d'abord la configuration"
                  : "Recalculer tous les documents non figés avec la configuration actuelle"
              }
            >
              <RefreshCw size={14} aria-hidden /> Appliquer aux documents non figés
            </Button>
            {dirty && (
              <span className="text-[12px] text-warning">
                Enregistrez la configuration avant de l'appliquer.
              </span>
            )}
            {recompute.isSuccess && !recompute.isPending && recompute.data && (
              <span className="text-[12px] text-success" data-testid="gold-recompute-result">
                {recompute.data.recomputed} document(s) recalculé(s) ·{" "}
                {recompute.data.todo} phrase(s) à trancher
                {recompute.data.skippedFinalized > 0 &&
                  ` · ${recompute.data.skippedFinalized} figé(s) ignoré(s)`}
                {recompute.data.skippedLocked > 0 &&
                  ` · ${recompute.data.skippedLocked} en cours d'arbitrage ignoré(s)`}
              </span>
            )}
          </div>
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

function LlmAnnotatorsSection({ slug, locked }: { slug: string; locked: boolean }) {
  const { data } = useGoldLlmAnnotators(slug);
  const mutate = useMutateGoldLlmAnnotator(slug);
  const judges = data?.results ?? [];

  return (
    <Section
      icon={<Bot size={15} className="text-info" aria-hidden />}
      title="Annotateurs issus des modèles"
      desc="Promouvez claude/codex/mistral en VRAIS annotateurs (comptes avec annotations soumises, dérivées de leurs pré-annotations) pour tester la résolution de bout en bout. Retirez-les pour qu'ils redeviennent une simple référence."
    >
      {judges.length === 0 ? (
        <div className="rounded-md border border-line bg-panel-muted/40 px-3 py-2 text-[12px] text-ink-muted">
          Aucune pré-annotation LLM importée sur ce projet.
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5" data-testid="gold-llm-annotators">
          {judges.map((j) => (
            <li
              key={j.judge}
              data-testid={`gold-llm-annotator-${j.judge}`}
              className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-1.5 text-sm"
            >
              <Bot size={14} className="text-info" aria-hidden />
              <span className="font-medium text-ink">{j.judge}</span>
              <span className="text-[11px] text-ink-muted">{j.documents} document(s)</span>
              {j.added ? (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                  annotateur
                </span>
              ) : (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-line bg-panel-muted px-2 py-0.5 text-[10px] text-ink-muted">
                  référence
                </span>
              )}
              <div className="ml-auto">
                {j.added ? (
                  <Button
                    variant="ghost"
                    data-testid={`gold-llm-remove-${j.judge}`}
                    disabled={locked || mutate.isPending}
                    onClick={() => mutate.mutate({ judge: j.judge, action: "remove" })}
                  >
                    <UserMinus size={13} aria-hidden /> Retirer
                  </Button>
                ) : (
                  <Button
                    variant="subtle"
                    data-testid={`gold-llm-add-${j.judge}`}
                    disabled={locked || mutate.isPending}
                    onClick={() => mutate.mutate({ judge: j.judge, action: "add" })}
                  >
                    <UserPlus size={13} aria-hidden /> Ajouter comme annotateur
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
