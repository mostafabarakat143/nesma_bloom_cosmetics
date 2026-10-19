import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountLinks } from "@/components/account/account-links";
import { ProfileForm } from "@/components/account/profile-form";
import { PageContainer } from "@/components/layout/page-container";
import { getAccountProfile } from "@/lib/auth/profile";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("profileTitle") };
}

export default async function AccountPage() {
  const t = await getTranslations("account");
  const user = await requireUser("/account");
  const profile = await getAccountProfile();

  return (
    <PageContainer>
      <section className="mx-auto w-full max-w-xl">
        <p className="text-sm tracking-[0.16em] text-rose-deep uppercase">{t("eyebrow")}</p>
        <h1 className="mt-3 font-display text-5xl leading-tight text-ink">{t("profileTitle")}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">{t("profileDescription")}</p>
        <div className="mt-6">
          <AccountLinks current="profile" />
        </div>
        <div className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-[0_8px_24px_rgb(52_42_46/6%)] sm:p-8">
          {profile ? (
            <ProfileForm profile={{ ...profile, email: profile.email || user.email }} />
          ) : (
            <p role="alert" className="text-sm text-rose-deep">
              {t("profileError")}
            </p>
          )}
        </div>
      </section>
    </PageContainer>
  );
}
