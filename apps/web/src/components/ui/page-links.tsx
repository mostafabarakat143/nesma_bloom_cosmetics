import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

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

export async function PageLinks({
  page,
  totalPages,
  hrefFor,
  label = "Pagination",
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  label?: string;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const t = await getTranslations("shop");
  const current = Math.min(Math.max(page, 1), totalPages);
  const pages = visiblePages(current, totalPages);

  return (
    <nav aria-label={label} className="mt-10 flex flex-wrap items-center gap-2">
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className={`${pageLink} border border-line bg-surface text-ink hover:bg-blush`}
        >
          {t("previous")}
        </Link>
      ) : (
        <span className={`${pageLink} text-muted`}>{t("previous")}</span>
      )}
      {pages.map((entry) => {
        const currentPage = entry === page;
        return (
          <Link
            key={entry}
            href={hrefFor(entry)}
            aria-current={currentPage ? "page" : undefined}
            className={
              currentPage
                ? `${pageLink} bg-rose-deep text-white`
                : `${pageLink} border border-line bg-surface text-ink hover:bg-blush`
            }
          >
            {entry}
          </Link>
        );
      })}
      {page < totalPages ? (
        <Link
          href={hrefFor(page + 1)}
          className={`${pageLink} border border-line bg-surface text-ink hover:bg-blush`}
        >
          {t("next")}
        </Link>
      ) : (
        <span className={`${pageLink} text-muted`}>{t("next")}</span>
      )}
    </nav>
  );
}
