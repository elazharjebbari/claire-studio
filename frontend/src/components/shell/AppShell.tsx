"use client";

/**
 * AppShell — chrome applicatif (sidebar + topbar + command palette) autour du
 * contenu. Le workspace d'annotation utilise sa propre disposition plein écran,
 * il rend donc ses enfants sans la chrome standard via la prop `bare`.
 */

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CommandPalette } from "./CommandPalette";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-ink">
      <a href="#main-content" className="skip-link">
        Aller au contenu
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div id="main-content" className="min-h-0 flex-1 overflow-auto">
          {children}
        </div>
      </div>
      <CommandPalette />
    </div>
  );
}
