"use client";

/**
 * Sélecteur d'arbitres en AUTOCOMPLÉTION — ajouter facilement quels membres (annotateurs)
 * sont autorisés à arbitrer. Filtre les membres du projet par nom/identifiant, propose une
 * liste, ajoute par clic/Entrée ; chips retirables. Accessible (combobox + listbox).
 */

import { useMemo, useRef, useState } from "react";
import { X, UserPlus, Search } from "lucide-react";
import type { ProjectMember } from "@/types/contract";

function Avatar({ name }: { name: string }) {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-panel-muted text-[9px] font-bold text-ink-muted"
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

const ROLE_LABEL: Record<ProjectMember["role"], string> = {
  annotator: "annotateur",
  reviewer: "reviewer",
  lead: "lead",
};

export interface ArbiterPickerProps {
  members: ProjectMember[];
  value: string[]; // usernames
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** Préfixe des `data-testid` — permet DEUX sélecteurs sur un même écran (arbitres ET
   *  participants attendus) sans collision. Défaut : comportement historique. */
  testIdPrefix?: string;
  /** Libellé du champ (le composant sert désormais deux rôles distincts). */
  placeholder?: string;
}

export function ArbiterPicker({
  members,
  value,
  onChange,
  disabled,
  testIdPrefix = "arbiter",
  placeholder,
}: ArbiterPickerProps) {
  const tid = (suffix: string) => `${testIdPrefix}-${suffix}`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const byUsername = useMemo(() => {
    const m = new Map<string, ProjectMember>();
    for (const mem of members) m.set(mem.username, mem);
    return m;
  }, [members]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => !value.includes(m.username))
      .filter((m) => !q || m.username.toLowerCase().includes(q) || m.displayName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [members, value, query]);

  function add(username: string) {
    if (!value.includes(username)) onChange([...value, username]);
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  }
  function remove(username: string) {
    onChange(value.filter((u) => u !== username));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, candidates.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = candidates[active];
      if (pick) add(pick.username);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && value.length > 0) {
      remove(value[value.length - 1]!);
    }
  }

  return (
    <div className="flex flex-col gap-2" data-testid={tid("picker")}>
      {/* Chips sélectionnés */}
      <ul className="flex flex-wrap gap-1.5" data-testid={tid("chips")}>
        {value.length === 0 && (
          <li className="text-[12px] text-ink-muted">
            Aucun arbitre nommé — politique par défaut (leads, reviewers).
          </li>
        )}
        {value.map((u) => {
          const m = byUsername.get(u);
          return (
            <li
              key={u}
              data-testid={tid(`chip-${u}`)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel-muted py-0.5 pl-1 pr-1.5 text-[12px]"
            >
              <Avatar name={m?.displayName ?? u} />
              <span className="text-ink">{m?.displayName ?? u}</span>
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Retirer ${m?.displayName ?? u}`}
                  data-testid={tid(`remove-${u}`)}
                  onClick={() => remove(u)}
                  className="rounded-full p-0.5 text-ink-muted hover:bg-danger/15 hover:text-danger"
                >
                  <X size={11} aria-hidden />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* Champ d'autocomplétion */}
      {!disabled && (
        <div className="relative">
          <div className="flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-1.5">
            <Search size={14} className="text-ink-muted" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={open && candidates.length > 0}
              aria-controls="arbiter-listbox"
              aria-autocomplete="list"
              data-testid={tid("input")}
              placeholder={placeholder ?? "Ajouter un arbitre (nom ou identifiant)…"}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                setActive(0);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              onKeyDown={onKeyDown}
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
            />
          </div>

          {open && candidates.length > 0 && (
            <ul
              id="arbiter-listbox"
              role="listbox"
              data-testid={tid("options")}
              className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-line bg-panel py-1 shadow-lg"
            >
              {candidates.map((m, i) => {
                return (
                  <li key={m.username} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      data-testid={tid(`option-${m.username}`)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        add(m.username);
                      }}
                      onMouseEnter={() => setActive(i)}
                      className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm ${
                        i === active ? "bg-panel-muted" : "hover:bg-panel-muted/60"
                      }`}
                    >
                      <Avatar name={m.displayName} />
                      <span className="text-ink">{m.displayName}</span>
                      <span className="font-mono text-[11px] text-ink-muted">{m.username}</span>
                      <span className="ml-auto rounded-full bg-panel-muted px-1.5 text-[10px] text-ink-muted">
                        {ROLE_LABEL[m.role]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {open && query.trim() !== "" && candidates.length === 0 && (
            <div
              data-testid={tid("no-match")}
              className="absolute z-20 mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-[12px] text-ink-muted shadow-lg"
            >
              <UserPlus size={12} className="mr-1 inline" aria-hidden /> Aucun membre ne correspond.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
