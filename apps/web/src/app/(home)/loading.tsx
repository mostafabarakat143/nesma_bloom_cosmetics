import { PageContainer } from "@/components/layout/page-container";

export default function Loading() {
  return (
    <PageContainer>
      <p className="text-muted" role="status">
        Loading…
      </p>
    </PageContainer>
  );
}
