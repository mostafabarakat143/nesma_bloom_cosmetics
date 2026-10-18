import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CheckoutView } from "@/components/checkout/checkout-view";
import { PageContainer } from "@/components/layout/page-container";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkout");
  return { title: t("title") };
}

export default async function CheckoutPage() {
  const t = await getTranslations("checkout");
  const user = await requireUser("/checkout");

  return (
    <PageContainer>
      <section className="mx-auto w-full max-w-3xl">
        <p className="text-sm tracking-[0.16em] text-rose-deep uppercase">{t("eyebrow")}</p>
        <h1 className="mt-3 font-display text-5xl leading-tight text-ink">{t("title")}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">{t("intro")}</p>
        <CheckoutView userId={user.id} role={user.role} />
      </section>
    </PageContainer>
  );
}
