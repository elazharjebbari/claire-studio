"use client";

import { GoldStatsPanel } from "@/components/gold/GoldStatsPanel";

export default function GoldStatsPage({ params }: { params: { slug: string } }) {
  return <GoldStatsPanel slug={params.slug} />;
}
