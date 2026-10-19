import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountLinks } from "@/components/account/account-links";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { PageContainer } from "@/components/layout/page-container";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("changeTitle") };
}

export default async function ChangePasswordPage() {
  const t = await getTranslations("account");
  await requireUser("/account/change-password");

  return (
    <PageContainer>
      <section className="mx-auto w-full max-w-xl">
        <p className="text-sm tracking-[0.16em] text-rose-deep uppercase">{t("eyebrow")}</p>
        <h1 className="mt-3 font-display text-5xl leading-tight text-ink">{t("changeTitle")}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">{t("changeDescription")}</p>
        <div className="mt-6">
          <AccountLinks current="password" />
        </div>
        <div className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-[0_8px_24px_rgb(52_42_46/6%)] sm:p-8">
          <ChangePasswordForm />
        </div>
      </section>
    </PageContainer>
  );
}
