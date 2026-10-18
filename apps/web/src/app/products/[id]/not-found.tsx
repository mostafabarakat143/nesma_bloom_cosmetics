import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Product not found",
};

export default function ProductNotFound() {
  return (
    <PageContainer>
      <section className="max-w-xl">
        <h1 className="font-display text-5xl text-ink">Product not found</h1>
        <p className="mt-4 text-lg text-muted">That product is not available.</p>
        <div className="mt-8">
          <Button href="/shop">Back to the shop</Button>
        </div>
      </section>
    </PageContainer>
  );
}
