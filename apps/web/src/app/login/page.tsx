import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { PageContainer } from "@/components/layout/page-container";
import { MESSAGES } from "@/lib/auth/credentials";
import { safeNextPath } from "@/lib/auth/redirect";
import { getVerifiedUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; expired?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const session = await getVerifiedUser();
  if (session.state === "authenticated") {
    redirect(nextPath);
  }

  const notice =
    params.notice === "password-changed"
      ? MESSAGES.passwordChanged
      : params.notice === "revoke-unconfirmed"
        ? MESSAGES.revokeUnconfirmed
        : params.notice === "reset"
          ? MESSAGES.resetSuccess
          : params.expired === "1"
            ? "Your session has ended. Please log in again."
            : null;

  return (
    <PageContainer>
      <AuthShell
        eyebrow="Account"
        title="Log in"
        description="Use the email and password for your Lamsa account."
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
