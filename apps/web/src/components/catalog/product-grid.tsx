import { ProductCard } from "@/components/catalog/product-card";
import type { CatalogProduct } from "@/lib/api/catalog";

export function ProductGrid({ products }: { products: CatalogProduct[] }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <li key={product.id} className="min-w-0">
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
