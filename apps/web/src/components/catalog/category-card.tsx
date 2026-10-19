import { ProductImage } from "@/components/catalog/product-image";
import { Link } from "@/i18n/navigation";
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
      <div className="relative aspect-[3/2] overflow-hidden rounded-t-2xl">
        <div className="absolute inset-0">
          <ProductImage url={category.imageUrl} alt={category.name} />
        </div>
      </div>
      <h3 className="px-4 py-4 font-display text-2xl leading-tight break-words text-ink">
        {category.name}
      </h3>
    </>
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_8px_24px_rgb(52_42_46/6%)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-rose-deep">
      {href ? (
        <Link href={href} className="block rounded-2xl">
          {content}
        </Link>
      ) : (
        <div>{content}</div>
      )}
    </article>
  );
}
