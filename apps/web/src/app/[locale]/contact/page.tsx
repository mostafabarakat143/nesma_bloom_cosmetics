import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ContactForm } from "@/components/contact/contact-form";
import { PageContainer } from "@/components/layout/page-container";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  return { title: t("title"), description: t("description") };
}

export default async function ContactPage() {
  const t = await getTranslations("contact");

  return (
    <PageContainer>
      <section className="max-w-3xl">
        <p className="text-sm tracking-[0.16em] text-rose-deep uppercase">{t("theHouse")}</p>
        <h1 className="mt-3 font-display text-5xl leading-tight text-ink sm:text-6xl">{t("heading")}</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">{t("intro")}</p>
      </section>

      <dl className="mx-auto mt-10 flex w-fit max-w-full flex-wrap items-center justify-center gap-4">
        <div className="flex items-baseline gap-2 rounded-2xl border border-line bg-surface px-6 py-4">
          <dt className="text-sm tracking-[0.12em] text-rose-deep uppercase">{t("email")}</dt>
          <dd className="text-base text-ink">
            <a href="mailto:hello@lamsa.com" className="hover:text-rose-deep">
              hello@lamsa.com
            </a>
          </dd>
        </div>
        <div className="flex items-baseline gap-2 rounded-2xl border border-line bg-surface px-6 py-4">
          <dt className="text-sm tracking-[0.12em] text-rose-deep uppercase">{t("phone")}</dt>
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
