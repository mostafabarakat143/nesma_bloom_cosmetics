import Link from "next/link";

import type { CatalogCategory } from "@/lib/api/catalog";

export function CategoryCard({
  category,
  href,
}: {
  category: CatalogCategory;
  href?: string;
}) {
  const content = (
    <>
      <h3 className="font-display text-3xl leading-tight break-words text-ink">
        {category.name}
      </h3>
      {category.description ? (
        <p className="mt-3 leading-relaxed break-words text-muted">
          {category.description}
        </p>
      ) : null}
    </>
  );

  return (
    <article className="rounded-2xl border border-line bg-surface shadow-[0_8px_24px_rgb(52_42_46/6%)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-rose-deep">
      {href ? (
        <Link href={href} className="block rounded-2xl p-6">
          {content}
        </Link>
      ) : (
        <div className="p-6">{content}</div>
      )}
    </article>
  );
}
