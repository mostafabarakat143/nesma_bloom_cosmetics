"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { TextField } from "@/components/auth/fields";
import { Button } from "@/components/ui/button";

export function Newsletter() {
  const t = useTranslations("home");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setMessage(t("subscribeInvalid"));
      return;
    }
    setMessage(null);
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
            {message ? (
              <p role="alert" className="text-sm text-rose-deep sm:basis-full">
                {message}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </section>
  );
}
