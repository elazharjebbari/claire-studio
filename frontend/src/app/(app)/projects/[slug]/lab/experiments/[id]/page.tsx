import { ExperimentResults } from "@/features/lab/ExperimentResults";

export default function LabExperimentPage({
  params,
}: {
  params: { slug: string; id: string };
}) {
  return (
    <div className="p-4">
      <ExperimentResults slug={params.slug} experimentId={params.id} />
    </div>
  );
}
