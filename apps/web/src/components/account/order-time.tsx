"use client";

import { useSyncExternalStore } from "react";

import { formatOrderDate } from "@/lib/orders/parse";

function subscribe() {
  return () => {};
}

export function OrderTime({ iso, locale }: { iso: string; locale: "ar" | "en" }) {
  const label = useSyncExternalStore(
    subscribe,
    () => formatOrderDate(iso, locale),
    () => "",
  );

  return <time dateTime={iso}>{label}</time>;
}
