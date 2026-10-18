import type { Metadata } from "next";

import { CheckoutView } from "@/components/checkout/checkout-view";
import { PageContainer } from "@/components/layout/page-container";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
};

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");

  return (
    <PageContainer>
      <section className="mx-auto w-full max-w-3xl">
        <p className="text-sm tracking-[0.16em] text-rose-deep uppercase">Order</p>
        <h1 className="mt-3 font-display text-5xl leading-tight text-ink">Checkout</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Review the products in this order. The shop calculates the final total when you place it.
        </p>
        <CheckoutView userId={user.id} role={user.role} />
      </section>
    </PageContainer>
  );
}
