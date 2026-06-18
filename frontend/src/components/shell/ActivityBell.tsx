"use client";

/** Cloche d'activité (F4) — « qui a annoté quoi ». Popover de derniers événements. */

import { useState } from "react";
import { useActivity } from "@/lib/api/hooks";

export function ActivityBell() {
  const [open, setOpen] = useState(false);
  const { data } = useActivity();
  const count = data?.results.length ?? 0;

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="activity-bell"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Activité récente (${count})`}
        className="relative rounded-md border border-line bg-panel px-2 py-1 text-sm text-ink hover:bg-panel-muted"
      >
        🔔
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] text-white">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Activité récente"
          className="absolute right-0 top-9 z-40 w-72 rounded-lg border border-line bg-elevated p-2 shadow-xl"
        >
          <p className="px-2 pb-1 text-xs font-semibold uppercase text-ink-muted">Activité</p>
          <ul className="flex flex-col gap-1">
            {data?.results.map((ev) => (
              <li key={ev.id} className="rounded-md px-2 py-1.5 text-sm hover:bg-panel-muted">
                <span className="font-medium text-ink">{ev.actorName ?? ev.actorId}</span>{" "}
                <span className="text-ink-muted">{ev.verb.replace(/_/g, " ")}</span>
                <div className="text-[11px] text-ink-muted">
                  {new Date(ev.createdAt).toLocaleString("fr-FR")}
                </div>
              </li>
            ))}
            {count === 0 && <li className="px-2 py-2 text-sm text-ink-muted">Rien de récent</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
