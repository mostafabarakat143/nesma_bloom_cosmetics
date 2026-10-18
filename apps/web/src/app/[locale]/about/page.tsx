import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { PageContainer } from "@/components/layout/page-container";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return { title: t("title"), description: t("description") };
}

export default async function AboutPage() {
  const t = await getTranslations("about");
  const practices = [
    { title: t("gentleTitle"), text: t("gentleBody") },
    { title: t("routineTitle"), text: t("routineBody") },
    { title: t("beautyTitle"), text: t("beautyBody") },
  ];

  return (
    <PageContainer>
      <section className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm tracking-[0.16em] text-rose-deep uppercase">{t("theHouse")}</p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-ink sm:text-5xl">
            {t("heading")}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">{t("intro")}</p>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-line">
          <Image
            src="/about-ritual.jpg"
            alt={t("ritualAlt")}
            fill
            priority
            sizes="(min-width: 1024px) 36rem, 100vw"
            className="object-cover"
          />
        </div>
      </section>

      <ul className="mt-12 grid gap-6 md:grid-cols-3">
        {practices.map((item) => (
          <li key={item.title} className="rounded-[1.5rem] border border-line bg-surface p-6">
            <h2 className="font-display text-3xl text-ink">{item.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{item.text}</p>
          </li>
        ))}
      </ul>

      <section className="mt-16 grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-line">
          <Image
            src="/about-line.jpg"
            alt={t("lineAlt")}
            fill
            sizes="(min-width: 1024px) 36rem, 100vw"
            className="object-cover"
          />
        </div>
        <div>
          <p className="text-sm tracking-[0.16em] text-rose-deep uppercase">{t("collection")}</p>
          <h2 className="mt-3 font-display text-4xl text-ink sm:text-5xl">{t("collectionTitle")}</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">{t("collectionBody")}</p>
        </div>
      </section>
    </PageContainer>
  );
}
