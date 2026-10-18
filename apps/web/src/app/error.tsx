"use client";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageContainer>
      <section className="max-w-xl">
      <h1 className="font-display text-5xl text-ink">Something went wrong</h1>
      <p className="mt-4 text-lg text-muted">
        The page could not be loaded. Please try again.
      </p>
      <div className="mt-8">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
      </div>
      </section>
    </PageContainer>
  );
}
