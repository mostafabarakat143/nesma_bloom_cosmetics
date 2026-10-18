import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountLinks } from "@/components/account/account-links";
import { EmptyState } from "@/components/catalog/empty-state";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { PageLinks } from "@/components/ui/page-links";
import { requireUser } from "@/lib/auth/session";
import { formatMinorPrice } from "@/lib/money";
import { loadMyOrders } from "@/lib/orders/load";
import { formatOrderDate, orderStatusLabel, ORDER_STATUSES } from "@/lib/orders/parse";
import { ordersHref, parseOrderListQuery, type OrderListQuery } from "@/lib/orders/query";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My orders",
};

const filters = ["ALL", ...ORDER_STATUSES] as const;

function filterLabel(status: (typeof filters)[number]): string {
  return status === "ALL" ? "All" : orderStatusLabel(status);
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser("/account/orders");
  const query = parseOrderListQuery(await searchParams);
  const result = await loadMyOrders(query);

  if (result.status === "unauthorized") {
    redirect("/login?next=%2Faccount%2Forders&expired=1");
  }

  return (
    <PageContainer>
      <p className="text-sm tracking-[0.16em] text-rose-deep uppercase">Account</p>
      <h1 className="mt-3 font-display text-5xl leading-tight text-ink">My orders</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
        Orders are listed with the newest first. Totals are the amounts saved when each order was placed.
      </p>
      <div className="mt-6">
        <AccountLinks current="orders" />
      </div>

      <nav aria-label="Order status" className="mt-8 flex flex-wrap gap-2">
        {filters.map((status) => {
          const active = query.status === status;
          const href = ordersHref({ page: 1, status });
          return (
            <Link
              key={status}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "inline-flex h-11 items-center rounded-2xl bg-blush px-4 text-sm text-rose-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
                  : "inline-flex h-11 items-center rounded-2xl border border-line bg-surface px-4 text-sm text-ink hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
              }
            >
              {filterLabel(status)}
            </Link>
          );
        })}
      </nav>

      <OrdersBody query={query} result={result} />
    </PageContainer>
  );
}

function OrdersBody({
  query,
  result,
}: {
  query: OrderListQuery;
  result: Awaited<ReturnType<typeof loadMyOrders>>;
}) {
  if (result.status === "unavailable") {
    return (
      <div className="mt-8">
        <EmptyState
          title="Orders are unavailable"
          message="We could not load your orders. Please try again in a moment."
          href={ordersHref(query)}
          action="Try again"
        />
      </div>
    );
  }
  if (result.status !== "ok") {
    return null;
  }

  if (result.page.items.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          title={query.status === "ALL" && query.page === 1 ? "No orders yet" : "No matching orders"}
          message={
            query.status === "ALL" && query.page === 1
              ? "When you place an order, it will appear here."
              : "Try another status or go back to the first page."
          }
          href={query.status === "ALL" && query.page === 1 ? "/shop" : ordersHref({ ...query, page: 1 })}
          action={query.status === "ALL" && query.page === 1 ? "Browse the shop" : "Back to the first page"}
        />
      </div>
    );
  }

  return (
    <>
      <ul className="mt-8 grid gap-4">
        {result.page.items.map((order) => (
          <li
            key={order.id}
            className="rounded-2xl border border-line bg-surface p-5 shadow-[0_8px_24px_rgb(52_42_46/6%)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl text-ink">Order {order.id}</h2>
                <p className="mt-2 text-sm text-muted">{formatOrderDate(order.createdAt)}</p>
                <p className="mt-2 text-sm text-ink">{orderStatusLabel(order.status)}</p>
              </div>
              <p className="text-base text-ink">{formatMinorPrice(order.totalMinor, order.currency)}</p>
            </div>
            <div className="mt-5">
              <Button href={`/account/orders/${order.id}`} variant="secondary">
                View order details
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <PageLinks
        page={query.page}
        totalPages={result.page.meta.totalPages}
        hrefFor={(page) => ordersHref(query, page)}
        label="Order pages"
      />
    </>
  );
}
