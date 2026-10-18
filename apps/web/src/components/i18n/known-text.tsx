"use client";

import { useTranslations } from "next-intl";

import { knownMessageKey } from "@/i18n/known-messages";

export function useKnownMessage() {
  const t = useTranslations("messages");
  return (message: string) => {
    const key = knownMessageKey(message);
    return key ? t(key) : message;
  };
}

export function KnownText({ value }: { value: string }) {
  const translate = useKnownMessage();
  return translate(value);
}
