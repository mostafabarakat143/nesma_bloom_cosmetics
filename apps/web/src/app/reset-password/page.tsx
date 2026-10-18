import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { ResetTokenCapture } from "@/components/auth/reset-token";
import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = {
  title: "Reset password",
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return (
    <PageContainer>
      <AuthShell
        eyebrow="Account"
        title="Reset password"
        description="Choose a new password for your Lamsa account."
      >
        <Suspense
          fallback={
            <p className="text-sm text-muted" role="status">
              Loading the reset form…
            </p>
          }
        >
          <ResetTokenCapture>
            <ResetPasswordForm />
          </ResetTokenCapture>
        </Suspense>
      </AuthShell>
    </PageContainer>
  );
}
