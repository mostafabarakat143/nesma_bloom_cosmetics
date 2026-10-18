import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PageContainer>
      <section className="max-w-xl">
      <h1 className="font-display text-5xl text-ink">Page not found</h1>
      <p className="mt-4 text-lg text-muted">
        That page is not part of Lamsa.
      </p>
      <div className="mt-8">
        <Button href="/">Back home</Button>
      </div>
      </section>
    </PageContainer>
  );
}
