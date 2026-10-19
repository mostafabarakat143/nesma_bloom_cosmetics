import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { redirectTo } from "@/i18n/redirect";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { PageContainer } from "@/components/layout/page-container";
import { safeNextPath } from "@/lib/auth/redirect";
import { getVerifiedUser } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("loginTitle") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; expired?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const session = await getVerifiedUser();
  if (session.state === "authenticated") {
    await redirectTo(nextPath);
  }

  const t = await getTranslations("auth");
  const messages = await getTranslations("messages");
  const notice =
    params.notice === "password-changed"
      ? messages("passwordChanged")
      : params.notice === "revoke-unconfirmed"
        ? messages("revokeUnconfirmed")
        : params.notice === "reset"
          ? messages("resetSuccess")
          : params.expired === "1"
            ? t("sessionEnded")
            : null;

  return (
    <PageContainer>
      <AuthShell
        eyebrow={t("account")}
        title={t("loginTitle")}
        description={t("loginDescription")}
      >
        {notice ? (
          <p role="status" className="mb-5 text-sm leading-relaxed text-ink">
            {notice}
          </p>
        ) : null}
        <LoginForm nextPath={nextPath} />
      </AuthShell>
    </PageContainer>
  );
}
