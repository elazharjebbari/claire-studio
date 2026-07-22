import { AnalysisLab } from "@/features/analysis/AnalysisLab";

export default function AnalysisPage({ params }: { params: { slug: string } }) {
  return <AnalysisLab slug={params.slug} />;
}
