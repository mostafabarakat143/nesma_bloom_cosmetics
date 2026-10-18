import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return (
    <PageContainer>
      <AuthShell
        eyebrow="Account"
        title="Forgot password"
        description="Enter your email. The response is the same whether or not an account exists."
      >
        <ForgotPasswordForm />
      </AuthShell>
    </PageContainer>
  );
}
