import { Button } from "@/components/ui/button";
import type { CatalogCategory, CatalogSubcategory } from "@/lib/api/catalog";
import { shopHref, type ShopQuery } from "@/lib/shop-query";

const fieldClass =
  "mt-2 h-11 w-full rounded-2xl border border-line bg-bg px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep";

const labelClass = "block text-sm font-medium text-ink";

export function ProductFilters({
  query,
  categories,
  subcategories,
}: {
  query: ShopQuery;
  categories: CatalogCategory[] | null;
  subcategories: CatalogSubcategory[] | null;
}) {
  const priceDescribedBy = query.priceError
    ? "price-hint price-error"
    : "price-hint";

  return (
    <form
      key={shopHref(query)}
      method="get"
      action="/shop"
      aria-label="Filter products"
      className="space-y-5 rounded-2xl border border-line bg-surface p-5"
    >
      <h2 className="font-display text-3xl text-ink">Filters</h2>
      <div>
        <label htmlFor="shop-search" className={labelClass}>
          Search
        </label>
        <input
          id="shop-search"
          name="q"
          type="text"
          defaultValue={query.q}
          maxLength={100}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="shop-category" className={labelClass}>
          Category
        </label>
        {categories === null ? (
          <>
            {query.categoryId !== null ? (
              <input type="hidden" name="categoryId" value={query.categoryId} />
            ) : null}
            <select id="shop-category" disabled className={fieldClass} defaultValue="">
              <option value="">Categories are temporarily unavailable</option>
            </select>
          </>
        ) : (
          <select
            id="shop-category"
            name="categoryId"
            defaultValue={query.categoryId ?? ""}
            className={fieldClass}
          >
            <option value="">All categories</option>
            {query.categoryId !== null &&
            !categories.some((category) => category.id === query.categoryId) ? (
              <option value={query.categoryId}>Selected category</option>
            ) : null}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div>
        <label htmlFor="shop-subcategory" className={labelClass}>
          Subcategory
        </label>
        {subcategories === null ? (
          <>
            {query.subcategoryId !== null ? (
              <input
                type="hidden"
                name="subcategoryId"
                value={query.subcategoryId}
              />
            ) : null}
            <select
              id="shop-subcategory"
              disabled
              className={fieldClass}
              defaultValue=""
            >
              <option value="">Subcategories are temporarily unavailable</option>
            </select>
          </>
        ) : (
          <select
            id="shop-subcategory"
            name="subcategoryId"
            defaultValue={query.subcategoryId ?? ""}
            className={fieldClass}
          >
            <option value="">All subcategories</option>
            {query.subcategoryId !== null &&
            !subcategories.some(
              (subcategory) => subcategory.id === query.subcategoryId,
            ) ? (
              <option value={query.subcategoryId}>Selected subcategory</option>
            ) : null}
            {subcategories.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>
                {subcategory.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <fieldset className="space-y-5">
        <legend className={labelClass}>Price (EGP)</legend>
        <p id="price-hint" className="text-sm text-muted">
          Enter amounts in EGP, such as 15 or 15.50.
        </p>
        <div>
          <label htmlFor="shop-min" className={labelClass}>
            Minimum
          </label>
          <input
            id="shop-min"
            name="minEgp"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={query.minEgpInput}
            aria-describedby={priceDescribedBy}
            aria-invalid={query.priceError ? true : undefined}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="shop-max" className={labelClass}>
            Maximum
          </label>
          <input
            id="shop-max"
            name="maxEgp"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={query.maxEgpInput}
            aria-describedby={priceDescribedBy}
            aria-invalid={query.priceError ? true : undefined}
            className={fieldClass}
          />
        </div>
        {query.priceError ? (
          <p
            id="price-error"
            role="alert"
            className="rounded-2xl bg-blush px-3 py-2 text-sm text-ink"
          >
            {query.priceError}
          </p>
        ) : null}
      </fieldset>
      <div>
        <label htmlFor="shop-sort" className={labelClass}>
          Sort
        </label>
        <select
          id="shop-sort"
          name="sort"
          defaultValue={query.sort}
          className={fieldClass}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="price-asc">Price, low to high</option>
          <option value="price-desc">Price, high to low</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit">Apply filters</Button>
        <Button href="/shop" variant="ghost">
          Clear
        </Button>
      </div>
    </form>
  );
}
