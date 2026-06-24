"use client";

import { GoldConfigStudio } from "@/components/gold/GoldConfigStudio";

export default function GoldConfigPage({ params }: { params: { slug: string } }) {
  return <GoldConfigStudio slug={params.slug} />;
}
