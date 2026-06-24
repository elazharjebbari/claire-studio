"use client";

import { GoldWorkspace } from "@/components/gold/GoldWorkspace";

export default function GoldAtelierPage({
  params,
}: {
  params: { slug: string; documentId: string };
}) {
  return (
    <div className="h-full">
      <GoldWorkspace slug={params.slug} documentId={params.documentId} />
    </div>
  );
}
