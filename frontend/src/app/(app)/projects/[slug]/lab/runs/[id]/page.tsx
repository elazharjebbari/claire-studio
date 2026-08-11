import { RunResults } from "@/features/lab/RunResults";

export default function LabRunPage({ params }: { params: { slug: string; id: string } }) {
  return (
    <div className="p-4">
      <RunResults slug={params.slug} runId={params.id} />
    </div>
  );
}
