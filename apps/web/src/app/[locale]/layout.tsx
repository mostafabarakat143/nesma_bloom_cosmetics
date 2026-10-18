import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { LocaleDocument } from "@/components/i18n/locale-document";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const t = await getTranslations("common");

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LocaleDocument />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:start-4 focus:z-[60] focus:rounded-2xl focus:bg-rose-deep focus:px-4 focus:py-2 focus:text-white"
      >
        {t("skip")}
      </a>
      <SiteHeader />
      <main id="main" className="w-full flex-1">
        {children}
      </main>
      <SiteFooter />
    </NextIntlClientProvider>
  );
}
