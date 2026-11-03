"use client";

import { ErrorState, type PageErrorProps } from "@/components/ui/error-state";
import english from "../../messages/en.json";

export default function Error({ reset }: PageErrorProps) {
  return (
    <ErrorState title={english.errors.wrongTitle} message={english.errors.wrongBody}
      retryLabel={english.errors.tryAgain} onRetry={reset} />
  );
}
