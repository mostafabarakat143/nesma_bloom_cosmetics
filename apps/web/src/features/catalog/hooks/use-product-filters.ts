"use client";

import { useRouter } from "@/i18n/navigation";
import { useCallback, useEffect, useRef, type FormEvent } from "react";

const FILTER_DEBOUNCE_MS = 300;

function useDebouncedCallback<TArgs extends unknown[]>(callback: (...args: TArgs) => void, delayMs: number) {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { callbackRef.current = callback; }, [callback]);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const schedule = useCallback((...args: TArgs) => {
    cancel();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      callbackRef.current(...args);
    }, delayMs);
  }, [cancel, delayMs]);

  return { schedule, cancel };
}

export function useProductFilters(filterKey: string) {
  const router = useRouter();
  const navigate = useCallback((href: string) => router.push(href), [router]);
  const { schedule, cancel } = useDebouncedCallback(navigate, FILTER_DEBOUNCE_MS);
  useEffect(() => cancel, [cancel, filterKey]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams();
    for (const [name, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string") query.append(name, value);
    }
    schedule(`/shop?${query.toString()}`);
  }

  return { onSubmit, cancelPending: cancel };
}
