"use client";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "./button";

export type PageErrorProps = { error: Error & { digest?: string }; reset: () => void };

export function ErrorState({ title, message, retryLabel, onRetry }: {
  title: string;
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <PageContainer>
      <section className="max-w-xl">
        <h1 className="font-display text-5xl text-ink">{title}</h1>
        <p className="mt-4 text-lg text-muted">{message}</p>
        <div className="mt-8">
          <Button type="button" onClick={() => onRetry()}>{retryLabel}</Button>
        </div>
      </section>
    </PageContainer>
  );
}
