import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { redirectTo } from "@/i18n/redirect";

import { AccountLinks } from "@/components/account/account-links";
import { EmptyState } from "@/components/catalog/empty-state";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { PageLinks } from "@/components/ui/page-links";
import { requireUser } from "@/lib/auth/session";
import { formatMinorPrice } from "@/lib/money";
import { loadMyOrders } from "@/lib/orders/load";
import { OrderTime } from "@/components/account/order-time";
import { ORDER_STATUSES } from "@/lib/orders/parse";
import { ordersHref, parseOrderListQuery, type OrderListQuery } from "@/lib/orders/query";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders");
  return { title: t("title") };
}

const filters = ["ALL", ...ORDER_STATUSES] as const;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("orders");
  await requireUser("/account/orders");
  const query = parseOrderListQuery(await searchParams);
  const result = await loadMyOrders(query);

  if (result.status === "unauthorized") {
    await redirectTo("/login?next=%2Faccount%2Forders&expired=1");
    return null;
  }

  return (
    <PageContainer>
      <p className="text-sm tracking-[0.16em] text-rose-deep uppercase">{t("eyebrow")}</p>
      <h1 className="mt-3 font-display text-5xl leading-tight text-ink">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">{t("description")}</p>
      <div className="mt-6">
        <AccountLinks current="orders" />
      </div>

      <nav aria-label={t("statusNav")} className="mt-8 flex flex-wrap gap-2">
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
              {status === "ALL" ? t("all") : t(status)}
            </Link>
          );
        })}
      </nav>

      <OrdersBody query={query} result={result} />
    </PageContainer>
  );
}

async function OrdersBody({
  query,
  result,
}: {
  query: OrderListQuery;
  result: Awaited<ReturnType<typeof loadMyOrders>>;
}) {
  const t = await getTranslations("orders");
  const shop = await getTranslations("shop");
  const checkout = await getTranslations("checkout");
  const locale = await getLocale();
  const dateLocale = locale === "ar" ? "ar" : "en";

  if (result.status === "unavailable") {
    return (
      <div className="mt-8">
        <EmptyState
          title={t("unavailableTitle")}
          message={t("unavailableMessage")}
          href={ordersHref(query)}
          action={t("tryAgain")}
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
          title={query.status === "ALL" && query.page === 1 ? t("noneTitle") : t("noMatchTitle")}
          message={
            query.status === "ALL" && query.page === 1 ? t("noneMessage") : t("noMatchMessage")
          }
          href={query.status === "ALL" && query.page === 1 ? "/shop" : ordersHref({ ...query, page: 1 })}
          action={query.status === "ALL" && query.page === 1 ? checkout("browse") : shop("backFirst")}
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
                <h2 className="font-display text-3xl text-ink">{t("orderTitle", { id: order.id })}</h2>
                <p className="mt-2 text-sm text-muted">
                  <OrderTime iso={order.createdAt} locale={dateLocale} />
                </p>
                <p className="mt-2 text-sm text-ink">{t(order.status)}</p>
              </div>
              <p className="text-base text-ink">{formatMinorPrice(order.totalMinor, order.currency)}</p>
            </div>
            <div className="mt-5 flex justify-end">
              <Button href={`/account/orders/${order.id}`} variant="secondary">
                {t("viewDetails")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <PageLinks
        page={query.page}
        totalPages={result.page.meta.totalPages}
        hrefFor={(page) => ordersHref(query, page)}
        label={t("orderPages")}
      />
    </>
  );
}
