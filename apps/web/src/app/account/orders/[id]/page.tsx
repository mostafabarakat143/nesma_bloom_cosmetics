import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AccountLinks } from "@/components/account/account-links";
import { OrderActions } from "@/components/account/order-actions";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { formatMinorPrice } from "@/lib/money";
import { loadOrder } from "@/lib/orders/load";
import { formatOrderDate, orderStatusLabel } from "@/lib/orders/parse";
import { parsePositiveId } from "@/lib/shop-query";

export const dynamic = "force-dynamic";

type OrderPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: OrderPageProps): Promise<Metadata> {
  const { id } = await params;
  const orderId = parsePositiveId(id);
  if (orderId === null || orderId === "invalid") {
    return { title: "Order not found" };
  }
  const result = await loadOrder(orderId);
  if (result.status === "ok") {
    return { title: `Order ${result.order.id}` };
  }
  if (result.status === "not_found") {
    return { title: "Order not found" };
  }
  return { title: "Order" };
}

export default async function OrderDetailPage({ params }: OrderPageProps) {
  const { id } = await params;
  const orderId = parsePositiveId(id);
  if (orderId === null || orderId === "invalid") {
    notFound();
  }

  await requireUser(`/account/orders/${orderId}`);
  const result = await loadOrder(orderId);
  if (result.status === "unauthorized") {
    redirect(`/login?next=${encodeURIComponent(`/account/orders/${orderId}`)}&expired=1`);
  }
  if (result.status === "not_found") {
    notFound();
  }
  if (result.status === "unavailable") {
    return (
      <PageContainer>
        <h1 className="font-display text-5xl text-ink">Order unavailable</h1>
        <p role="alert" className="mt-4 max-w-xl text-muted">
          We could not load this order. Please try again in a moment.
        </p>
        <div className="mt-8">
          <Button href={`/account/orders/${orderId}`} variant="secondary">
            Try again
          </Button>
        </div>
      </PageContainer>
    );
  }

  const { order } = result;

  return (
    <PageContainer>
      <p className="text-sm tracking-[0.16em] text-rose-deep uppercase">Account</p>
      <h1 className="mt-3 font-display text-5xl leading-tight text-ink">Order {order.id}</h1>
      <div className="mt-6">
        <AccountLinks current="orders" />
      </div>
      <div className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-[0_8px_24px_rgb(52_42_46/6%)] sm:p-8">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted">Placed</dt>
            <dd className="mt-1 text-ink">{formatOrderDate(order.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Status</dt>
            <dd className="mt-1 text-ink">{orderStatusLabel(order.status)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Total</dt>
            <dd className="mt-1 text-ink">{formatMinorPrice(order.totalMinor, order.currency)}</dd>
          </div>
        </dl>

        <h2 className="mt-8 font-display text-3xl text-ink">Items</h2>
        <ul className="mt-4 divide-y divide-line">
          {order.items.map((item) => (
            <li key={item.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:gap-6">
              <div>
                <p className="text-ink">{item.productNameSnapshot}</p>
                {item.productSkuSnapshot.trim() ? (
                  <p className="mt-1 text-sm text-muted">SKU {item.productSkuSnapshot}</p>
                ) : null}
                <p className="mt-1 text-sm text-muted">
                  {item.quantity} × {formatMinorPrice(item.unitPriceMinor, order.currency)}
                </p>
              </div>
              <p className="text-ink">{formatMinorPrice(item.lineTotalMinor, order.currency)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-line pt-4 text-ink">
          Order total {formatMinorPrice(order.totalMinor, order.currency)}
        </p>
        <OrderActions orderId={order.id} status={order.status} />
      </div>
      <div className="mt-6">
        <Button href="/account/orders" variant="secondary">
          Back to my orders
        </Button>
      </div>
    </PageContainer>
  );
}
