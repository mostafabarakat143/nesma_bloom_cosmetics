"use client";

import { useCallback, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { errorMessage, requestErrorAction, type ErrorHandlingOptions, type RequestFailure } from "./errors";

export function useErrorHandler() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);
  const reportError = useCallback((failure: unknown, fallback?: string) => {
    setError(errorMessage(failure, fallback));
  }, []);

  const handleError = useCallback((failure: RequestFailure, options: ErrorHandlingOptions = {}) => {
    const action = requestErrorAction(failure, options);
    if (action.type === "redirect") {
      router.push(action.href);
      router.refresh();
      return true;
    }
    setError(action.message);
    if (action.refresh) router.refresh();
    return false;
  }, [router]);

  return { error, setError, clearError, reportError, handleError };
}
