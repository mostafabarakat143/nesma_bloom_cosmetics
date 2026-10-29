import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { shopHref, type ShopQuery } from "@/lib/shop-query";
function visiblePages(current: number, total: number): number[] {
  const end = Math.min(total, Math.max(current + 2, 5));
  const start = Math.max(1, end - 4);
  const pages: number[] = [];
  for (let page = start; page <= Math.min(total, start + 4); page += 1) {
    pages.push(page);
  }
  return pages;
}

const pageLink =
  "inline-flex h-11 min-w-11 items-center justify-center rounded-2xl px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep";

export async function Pagination({
  query,
  totalPages,
}: {
  query: ShopQuery;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const t = await getTranslations("shop");
  const nav = await getTranslations("common");
  const current = Math.min(query.page, totalPages);
  const pages = visiblePages(current, totalPages);

  return (
    <nav aria-label={nav("pagination")} className="mt-10 flex flex-wrap items-center gap-2">
      {query.page > 1 ? (
        <Link href={shopHref(query, query.page - 1)} className={`${pageLink} border border-line bg-surface text-ink hover:bg-blush`}>
          {t("previous")}
        </Link>
      ) : (
        <span className={`${pageLink} text-muted`}>{t("previous")}</span>
      )}
      {pages.map((page) => {
        const currentPage = page === query.page;
        return (
          <Link
            key={page}
            href={shopHref(query, page)}
            aria-current={currentPage ? "page" : undefined}
            className={
              currentPage
                ? `${pageLink} bg-rose-deep text-white`
                : `${pageLink} border border-line bg-surface text-ink hover:bg-blush`
            }
          >
            {page}
          </Link>
        );
      })}
      {query.page < totalPages ? (
        <Link href={shopHref(query, query.page + 1)} className={`${pageLink} border border-line bg-surface text-ink hover:bg-blush`}>
          {t("next")}
        </Link>
      ) : (
        <span className={`${pageLink} text-muted`}>{t("next")}</span>
      )}
    </nav>
  );
}
