import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { getPathname } from "@/i18n/navigation";
import { knownMessageKey } from "@/i18n/known-messages";
import type { CatalogCategory, CatalogSubcategory } from "@/lib/api/catalog";
import { shopHref, type ShopQuery } from "@/lib/shop-query";

const fieldClass =
  "mt-2 h-11 w-full rounded-2xl border border-line bg-bg px-3 text-sm text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep";

const labelClass = "block text-sm font-medium text-ink";

export async function ProductFilters({
  query,
  categories,
  subcategories,
}: {
  query: ShopQuery;
  categories: CatalogCategory[] | null;
  subcategories: CatalogSubcategory[] | null;
}) {
  const t = await getTranslations("shop");
  const messages = await getTranslations("messages");
  const locale = await getLocale();
  const priceDescribedBy = query.priceError
    ? "price-hint price-error"
    : "price-hint";
  const priceKey = query.priceError ? knownMessageKey(query.priceError) : null;
  const priceMessage = query.priceError
    ? priceKey
      ? messages(priceKey)
      : query.priceError
    : null;

  return (
    <form
      key={shopHref(query)}
      method="get"
      action={getPathname({ locale, href: "/shop" })}
      aria-label={t("filterProducts")}
      className="space-y-5 rounded-2xl border border-line bg-surface p-5"
    >
      <h2 className="font-display text-3xl text-ink">{t("filters")}</h2>
      <div>
        <label htmlFor="shop-search" className={labelClass}>
          {t("search")}
        </label>
        <input
          id="shop-search"
          name="q"
          type="text"
          defaultValue={query.q}
          placeholder={t("searchPlaceholder")}
          maxLength={100}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="shop-category" className={labelClass}>
          {t("category")}
        </label>
        {categories === null ? (
          <>
            {query.categoryId !== null ? (
              <input type="hidden" name="categoryId" value={query.categoryId} />
            ) : null}
            <select id="shop-category" disabled className={fieldClass} defaultValue="">
              <option value="">{t("categoriesUnavailable")}</option>
            </select>
          </>
        ) : (
          <select
            id="shop-category"
            name="categoryId"
            defaultValue={query.categoryId ?? ""}
            className={fieldClass}
          >
            <option value="">{t("allCategories")}</option>
            {query.categoryId !== null &&
            !categories.some((category) => category.id === query.categoryId) ? (
              <option value={query.categoryId}>{t("selectedCategory")}</option>
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
          {t("subcategory")}
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
              <option value="">{t("subcategoriesUnavailable")}</option>
            </select>
          </>
        ) : (
          <select
            id="shop-subcategory"
            name="subcategoryId"
            defaultValue={query.subcategoryId ?? ""}
            className={fieldClass}
          >
            <option value="">{t("allSubcategories")}</option>
            {query.subcategoryId !== null &&
            !subcategories.some(
              (subcategory) => subcategory.id === query.subcategoryId,
            ) ? (
              <option value={query.subcategoryId}>{t("selectedSubcategory")}</option>
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
        <legend className={labelClass}>{t("price")}</legend>
        <p id="price-hint" className="text-sm text-muted">
          {t("priceHint")}
        </p>
        <div>
          <label htmlFor="shop-min" className={labelClass}>
            {t("minimum")}
          </label>
          <input
            id="shop-min"
            name="minEgp"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={query.minEgpInput}
            placeholder={t("minimumPlaceholder")}
            aria-describedby={priceDescribedBy}
            aria-invalid={query.priceError ? true : undefined}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="shop-max" className={labelClass}>
            {t("maximum")}
          </label>
          <input
            id="shop-max"
            name="maxEgp"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={query.maxEgpInput}
            placeholder={t("maximumPlaceholder")}
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
            {priceMessage}
          </p>
        ) : null}
      </fieldset>
      <div>
        <label htmlFor="shop-sort" className={labelClass}>
          {t("sort")}
        </label>
        <select
          id="shop-sort"
          name="sort"
          defaultValue={query.sort}
          className={fieldClass}
        >
          <option value="newest">{t("newest")}</option>
          <option value="oldest">{t("oldest")}</option>
          <option value="name-asc">{t("nameAsc")}</option>
          <option value="name-desc">{t("nameDesc")}</option>
          <option value="price-asc">{t("priceAsc")}</option>
          <option value="price-desc">{t("priceDesc")}</option>
        </select>
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <Button href="/shop" variant="ghost">
          {t("clear")}
        </Button>
        <Button type="submit">{t("apply")}</Button>
      </div>
    </form>
  );
}
