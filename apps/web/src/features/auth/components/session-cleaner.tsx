"use client";

import { useSessionCleaner } from "../hooks/use-session-cleaner";

export function SessionCleaner() {
  useSessionCleaner();
  return null;
}
