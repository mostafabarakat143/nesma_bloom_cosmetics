import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export type BreadcrumbItem = {
  label: string;
  href?: string;
  current?: boolean;
};

export async function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const t = await getTranslations("common");
  return (
    <nav aria-label={t("breadcrumb")}>
      <ol className="flex flex-wrap items-center gap-2 text-sm text-muted">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href && !item.current ? (
              <Link
                href={item.href}
                className="text-rose-deep underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current={item.current ? "page" : undefined}
                className="break-words text-ink"
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
