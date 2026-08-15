import { RunResults } from "@/features/lab/RunResults";

export default function LabRunPage({ params }: { params: { slug: string; id: string } }) {
  return (
    <div className="mx-auto w-full max-w-5xl p-4">
      <RunResults slug={params.slug} runId={params.id} />
    </div>
  );
}
