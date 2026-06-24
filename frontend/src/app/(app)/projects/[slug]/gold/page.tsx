"use client";

import { GoldCockpit } from "@/components/gold/GoldCockpit";

export default function GoldCockpitPage({ params }: { params: { slug: string } }) {
  return <GoldCockpit slug={params.slug} />;
}
