import { isRecord } from "./lib/guards";
import { createValidation } from "./validation";

const validation = createValidation();

export type RequestFailure = { ok: false; status: number; message: string };

 export function responseErrorMessage(payload: unknown, fallback = validation.messages.unavailable): string {
  return isRecord(payload) && typeof payload.message === "string" ? payload.message : fallback;
}

 export function errorMessage(error: unknown, fallback?: string): string {
  const message = typeof error === "string" ? error
    : isRecord(error) && typeof error.status === "number"
      ? responseErrorMessage(error, fallback ?? validation.messages.unavailable)
      : fallback ?? validation.messages.unavailable;
  return fallback === undefined ? message : message || fallback;
}

export type ErrorHandlingOptions = {
  loginPath?: string;
  fallback?: string;
  refreshOnConflict?: boolean;
};

export type ErrorAction =
  | { type: "redirect"; href: string }
  | { type: "display"; message: string; refresh: boolean };

export function requestErrorAction(failure: RequestFailure, options: ErrorHandlingOptions = {}): ErrorAction {
  if (failure.status === 401 && options.loginPath) {
    return { type: "redirect", href: options.loginPath };
  }
  return {
    type: "display",
    message: errorMessage(failure, options.fallback),
    refresh: failure.status === 409 && options.refreshOnConflict === true,
  };
}
