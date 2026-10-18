import type { Metadata } from "next";

import { ContactForm } from "@/components/contact/contact-form";
import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Write or call Lamsa about an order, a product, or a question.",
};

export default function ContactPage() {
  return (
    <PageContainer>
      <section className="max-w-3xl">
        <p className="text-sm tracking-[0.16em] text-rose-deep uppercase">The house</p>
        <h1 className="mt-3 font-display text-5xl leading-tight text-ink sm:text-6xl">
          Contact us
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          Write or call, and a member of the team can help with an order, a
          product, or a question.
        </p>
      </section>

      <dl className="mx-auto mt-10 flex w-fit max-w-full flex-wrap items-center justify-center gap-4">
        <div className="flex items-baseline gap-2 rounded-2xl border border-line bg-surface px-6 py-4">
          <dt className="text-sm tracking-[0.12em] text-rose-deep uppercase">Email:</dt>
          <dd className="text-base text-ink">
            <a href="mailto:hello@lamsa.com" className="hover:text-rose-deep">
              hello@lamsa.com
            </a>
          </dd>
        </div>
        <div className="flex items-baseline gap-2 rounded-2xl border border-line bg-surface px-6 py-4">
          <dt className="text-sm tracking-[0.12em] text-rose-deep uppercase">Phone:</dt>
          <dd className="text-base text-ink">
            <a href="tel:+201015981398" className="hover:text-rose-deep">
              +20 101 598 1398
            </a>
          </dd>
        </div>
      </dl>

      <ContactForm />
    </PageContainer>
  );
}
