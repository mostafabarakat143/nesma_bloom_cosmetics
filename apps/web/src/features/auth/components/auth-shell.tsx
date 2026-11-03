import type { ReactNode } from "react";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-md">
      <p className="text-sm tracking-[0.16em] text-rose-deep uppercase">{eyebrow}</p>
      <h1 className="mt-3 font-display text-5xl leading-tight text-ink sm:text-6xl">
        {title}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted">{description}</p>
      <div className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-[0_8px_24px_rgb(52_42_46/6%)] sm:p-8">
        {children}
      </div>
    </section>
  );
}

export function authLinkClass() {
  return "text-rose-deep underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep";
}
