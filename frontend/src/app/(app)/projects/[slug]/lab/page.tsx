import { LabWorkspace } from "@/features/lab/LabWorkspace";

export default function LabPage({ params }: { params: { slug: string } }) {
  return <LabWorkspace slug={params.slug} />;
}
