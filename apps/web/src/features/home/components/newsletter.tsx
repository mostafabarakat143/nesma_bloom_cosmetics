"use client";

import { createValidation } from "@/shared/validation";

import { ErrorMessage } from "@/components/ui/error-message";

import { useErrorHandler } from "@/shared/use-error-handler";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { TextField } from "@/components/ui/fields";

export function Newsletter() {
  const t = useTranslations("home");
  const validationT = useTranslations("validation");
  const validation = createValidation(validationT);
  const schema = validation.newsletter();
  const [email, setEmail] = useState("");
  const { error: message, clearError, reportError } = useErrorHandler();
  const [done, setDone] = useState(false);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      reportError(parsed.error.issues[0].message);
      return;
    }
    clearError();
    setDone(true);
  }

  return (
    <section
      className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20"
      aria-labelledby="newsletter-heading"
    >
      <div className="rounded-4xl border border-line bg-blush px-6 py-10 sm:px-10">
        <h2
          id="newsletter-heading"
          className="font-display text-4xl text-ink sm:text-5xl"
        >
          {t("subscribeTitle")}
        </h2>
        <p id="newsletter-note" className="mt-4 max-w-xl text-lg text-ink">
          {t("subscribeBody")}
        </p>
        {done ? (
          <p className="mt-8 text-lg text-ink" role="status">
            {t("subscribeThanks")}
          </p>
        ) : (
          <form
            onSubmit={onSubmit}
            noValidate
            className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row"
            aria-describedby="newsletter-note"
          >
            <div className="min-w-0 flex-1">
              <TextField
                id="newsletter-email"
                name="email"
                label={t("email")}
                labelClassName="sr-only"
                type="email"
                autoComplete="email"
                value={email}
                placeholder={t("emailPlaceholder")}
                onChange={setEmail}
                controlClassName="h-11 w-full rounded-2xl border border-line bg-surface px-4 text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
              />
            </div>
            <Button type="submit">{t("notify")}</Button>
            <ErrorMessage message={message} className="text-sm text-rose-deep sm:basis-full" translate={false} />
          </form>
        )}
      </div>
    </section>
  );
}
