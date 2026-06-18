"use client";

/**
 * Rendu Markdown stylé Tailwind pour le centre d'aide (react-markdown + remark-gfm).
 * Mappe chaque élément Markdown sur des classes alignées sur les tokens sombres
 * (text-ink, text-ink-muted, bg-panel, border-line, text-accent).
 */

import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mb-4 mt-2 text-2xl font-semibold text-ink">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-8 border-b border-line pb-1 text-lg font-semibold text-ink">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-5 text-base font-semibold text-ink">{children}</h3>
  ),
  p: ({ children }) => <p className="my-3 leading-relaxed text-ink-muted">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1 pl-6 text-ink-muted">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1 pl-6 text-ink-muted">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => {
    const target = href ?? "#";
    const isInternal = target.startsWith("/");
    if (isInternal) {
      return (
        <Link href={target} className="text-accent hover:underline">
          {children}
        </Link>
      );
    }
    return (
      <a
        href={target}
        className="text-accent hover:underline"
        rel="noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  },
  code: ({ children }) => (
    <code className="rounded bg-panel-muted px-1.5 py-0.5 font-mono text-[0.85em] text-ink">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-md border border-line bg-panel p-3 font-mono text-sm text-ink">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-accent/60 bg-panel/40 py-1 pl-4 text-ink-muted">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-panel-muted">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-line px-3 py-1.5 text-left font-semibold text-ink">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-line px-3 py-1.5 text-ink-muted">{children}</td>
  ),
  hr: () => <hr className="my-6 border-line" />,
};

export function HelpMarkdown({ source }: { source: string }) {
  return (
    <div data-testid="help-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
