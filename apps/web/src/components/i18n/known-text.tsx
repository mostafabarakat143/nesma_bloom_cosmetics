"use client";

import { createValidation } from "@/shared/validation";

import { useTranslations } from "next-intl";

const defaultValidation = createValidation();
export function useKnownMessage() {
  const t = useTranslations("validation");
  return (message: string) => {
    const key = defaultValidation.messageKey(message);
    return key ? t(key) : message;
  };
}
export function KnownText({ value }: { value: string; }) {
  const translate = useKnownMessage();
  return translate(value);
}
