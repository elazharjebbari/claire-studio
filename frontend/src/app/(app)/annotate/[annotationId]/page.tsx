import { AnnotationWorkspace } from "@/components/workspace/AnnotationWorkspace";

export default function AnnotatePage({ params }: { params: { annotationId: string } }) {
  return (
    <div className="h-full">
      <AnnotationWorkspace annotationId={params.annotationId} />
    </div>
  );
}
