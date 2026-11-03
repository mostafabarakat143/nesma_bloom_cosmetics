"use client";

import { formatOrderDate } from "@/features/orders/lib/parse";
import { useSyncExternalStore } from "react";

function subscribe() {
  return () => { };
}

export function OrderTime({ iso, locale }: { iso: string; locale: "ar" | "en"; }) {
  const label = useSyncExternalStore(
    subscribe,
    () => formatOrderDate(iso, locale),
    () => "",
  );

  return <time dateTime={iso}>{label}</time>;
}
