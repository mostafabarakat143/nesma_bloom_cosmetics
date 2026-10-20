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
  const body = (
    <>
      <span className="absolute inset-0 bg-white">
        <ProductImage url={category.imageUrl} alt={category.name} />
      </span>
      {/* Text sits on the image; mix-blend flips white↔black against the photo */}
      <h3 className="absolute inset-x-0 bottom-0 truncate px-3 py-3 font-display text-3xl font-bold leading-none text-white mix-blend-difference">
        {category.name}
      </h3>
    </>
  );

  return (
    <article className="relative isolate aspect-[5/6] overflow-hidden rounded-2xl shadow-[0_10px_24px_rgb(52_42_46/10%)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-rose-deep">
      {href ? (
        <Link href={href} className="absolute inset-0">
          {body}
        </Link>
      ) : (
        <div className="absolute inset-0">{body}</div>
      )}
    </article>
  );
}
