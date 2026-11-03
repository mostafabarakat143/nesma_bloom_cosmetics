"use client";

import type { ComponentProps } from "react";
import { KnownText } from "@/components/i18n/known-text";

type ErrorMessageProps = Omit<ComponentProps<"p">, "children" | "role" | "translate"> & {
  message?: string | null;
  announce?: boolean;
  translate?: boolean;
};

export function ErrorMessage({
  message,
  announce = true,
  translate = true,
  className = "text-sm text-rose-deep",
  ...props
}: ErrorMessageProps) {
  if (!message) return null;
  return (
    <p {...props} role={announce ? "alert" : undefined} className={className}>
      {translate ? <KnownText value={message} /> : message}
    </p>
  );
}
