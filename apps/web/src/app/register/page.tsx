import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { PageContainer } from "@/components/layout/page-container";
import { safeNextPath } from "@/lib/auth/redirect";
import { getVerifiedUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Create account",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const session = await getVerifiedUser();
  if (session.state === "authenticated") {
    redirect(nextPath);
  }

  return (
    <PageContainer>
      <AuthShell
        eyebrow="Account"
        title="Create an account"
        description="Registration opens a customer account. You can shop as soon as it is created."
      >
        <RegisterForm nextPath={nextPath} />
      </AuthShell>
    </PageContainer>
  );
}
