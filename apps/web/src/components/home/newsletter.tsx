"use client";

import { useState, type FormEvent } from "react";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setMessage("Enter an email address.");
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
      <div className="rounded-[2rem] border border-line bg-blush px-6 py-10 sm:px-10">
        <h2
          id="newsletter-heading"
          className="font-display text-4xl text-ink sm:text-5xl"
        >
          Subscribe for what is new
        </h2>
        <p id="newsletter-note" className="mt-4 max-w-xl text-lg text-ink">
          New arrivals, seasonal edits, and quiet notes from the house.
        </p>
        {done ? (
          <p className="mt-8 text-lg text-ink" role="status">
            Thanks. We’ll write when something new arrives.
          </p>
        ) : (
          <form
            onSubmit={onSubmit}
            noValidate
            className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row"
            aria-describedby="newsletter-note"
          >
            <div className="min-w-0 flex-1">
              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="newsletter-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                placeholder="you@example.com"
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full rounded-2xl border border-line bg-surface px-4 text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-rose-deep px-5 text-sm font-medium text-white hover:bg-rose-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
            >
              Notify me
            </button>
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
