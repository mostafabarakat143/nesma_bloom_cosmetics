import {
  minorToEgpInput,
  parseEgpToMinor,
  PRICE_MINOR_MAX,
} from "@/lib/money";

export const SHOP_PAGE_SIZE = 12;

export const SHOP_SORTS = [
  "newest",
  "oldest",
  "name-asc",
  "name-desc",
  "price-asc",
  "price-desc",
] as const;

export type ShopSort = (typeof SHOP_SORTS)[number];

const RECOGNIZED_PARAMS = [
  "q",
  "categoryId",
  "subcategoryId",
  "minPrice",
  "maxPrice",
  "minEgp",
  "maxEgp",
  "sort",
  "page",
] as const;

export type RawSearchParams = Record<string, string | string[] | undefined>;

export type ShopQuery = {
  q: string;
  categoryId: number | null;
  subcategoryId: number | null;
  minPriceMinor: number | null;
  maxPriceMinor: number | null;
  minEgpInput: string;
  maxEgpInput: string;
  sort: ShopSort;
  page: number;
  priceError: string | null;
  /** "egp" keeps an invalid typed amount in the URL. Valid ranges use integer piastres. */
  priceUrl: "minor" | "egp";
  minPriceRaw: string;
  maxPriceRaw: string;
};

const PRICE_ERROR =
  "Enter prices in EGP, such as 15 or 15.50. Negative values and extra decimal places are not accepted.";
const RANGE_ERROR = "Minimum price cannot be higher than maximum price.";

export function firstString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

/** Positive 32-bit id, or null when the field is empty. "invalid" is never sent to the API. */
export function parsePositiveId(raw: string): number | null | "invalid" {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }
  if (!/^[1-9]\d*$/.test(trimmed)) {
    return "invalid";
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value > PRICE_MINOR_MAX) {
    return "invalid";
  }
  return value;
}

function parseMinorParam(raw: string): number | null | "invalid" {
  if (raw === "") {
    return null;
  }
  if (!/^\d+$/.test(raw) || raw.length > 10) {
    return "invalid";
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > PRICE_MINOR_MAX) {
    return "invalid";
  }
  return value;
}

function parsePage(raw: string): number | "invalid" {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return 1;
  }
  if (!/^[1-9]\d*$/.test(trimmed)) {
    return "invalid";
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value > 10_000) {
    return "invalid";
  }
  return value;
}

function parseSort(raw: string): ShopSort | "invalid" {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "newest") {
    return "newest";
  }
  if ((SHOP_SORTS as readonly string[]).includes(trimmed)) {
    return trimmed as ShopSort;
  }
  return "invalid";
}

export function shopHref(query: ShopQuery, page = query.page): string {
  const params = new URLSearchParams();
  if (query.q) {
    params.set("q", query.q);
  }
  if (query.categoryId !== null) {
    params.set("categoryId", String(query.categoryId));
  }
  if (query.subcategoryId !== null) {
    params.set("subcategoryId", String(query.subcategoryId));
  }

  if (query.priceUrl === "egp") {
    if (query.minEgpInput) {
      params.set("minEgp", query.minEgpInput);
    }
    if (query.maxEgpInput) {
      params.set("maxEgp", query.maxEgpInput);
    }
  } else if (
    query.priceError &&
    query.minPriceMinor === null &&
    query.maxPriceMinor === null
  ) {
    if (query.minPriceRaw) {
      params.set("minPrice", query.minPriceRaw);
    }
    if (query.maxPriceRaw) {
      params.set("maxPrice", query.maxPriceRaw);
    }
  } else {
    if (query.minPriceMinor !== null) {
      params.set("minPrice", String(query.minPriceMinor));
    }
    if (query.maxPriceMinor !== null) {
      params.set("maxPrice", String(query.maxPriceMinor));
    }
  }

  if (query.sort !== "newest") {
    params.set("sort", query.sort);
  }
  if (page > 1) {
    params.set("page", String(page));
  }

  const serialized = params.toString();
  return serialized ? `/shop?${serialized}` : "/shop";
}

function queryFromHref(path: string): URLSearchParams {
  const marker = "/shop?";
  if (!path.startsWith(marker)) {
    return new URLSearchParams();
  }
  return new URLSearchParams(path.slice(marker.length));
}

function stablePath(params: URLSearchParams): string {
  const entries = [...params.entries()].sort(
    (left, right) =>
      left[0].localeCompare(right[0]) || left[1].localeCompare(right[1]),
  );
  const query = new URLSearchParams(entries).toString();
  return query ? `/shop?${query}` : "/shop";
}

function actualParams(raw: RawSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of RECOGNIZED_PARAMS) {
    const value = firstString(raw[key]);
    if (value.trim() !== "") {
      params.set(key, value);
    }
  }
  return params;
}

function hasUnknownParam(raw: RawSearchParams): boolean {
  const recognized = new Set<string>(RECOGNIZED_PARAMS);
  return Object.keys(raw).some((key) => {
    if (recognized.has(key)) {
      return false;
    }
    return firstString(raw[key]).trim() !== "";
  });
}

function rangeError(
  minPriceMinor: number | null,
  maxPriceMinor: number | null,
): string | null {
  if (
    minPriceMinor !== null &&
    maxPriceMinor !== null &&
    minPriceMinor > maxPriceMinor
  ) {
    return RANGE_ERROR;
  }
  return null;
}

export function parseShopQuery(raw: RawSearchParams): {
  query: ShopQuery;
  redirectTo: string | null;
} {
  const q = firstString(raw.q).trim().slice(0, 100);
  const categoryParsed = parsePositiveId(firstString(raw.categoryId));
  const subcategoryParsed = parsePositiveId(firstString(raw.subcategoryId));
  const sortParsed = parseSort(firstString(raw.sort));
  const pageParsed = parsePage(firstString(raw.page));

  const categoryId = categoryParsed === "invalid" ? null : categoryParsed;
  const subcategoryId =
    subcategoryParsed === "invalid" ? null : subcategoryParsed;
  const sort: ShopSort = sortParsed === "invalid" ? "newest" : sortParsed;
  let page = pageParsed === "invalid" ? 1 : pageParsed;

  let minPriceMinor: number | null = null;
  let maxPriceMinor: number | null = null;
  let minEgpInput = "";
  let maxEgpInput = "";
  let priceError: string | null = null;
  let priceUrl: "minor" | "egp" = "minor";
  let minPriceRaw = "";
  let maxPriceRaw = "";

  const hasEgp = raw.minEgp !== undefined || raw.maxEgp !== undefined;

  if (hasEgp) {
    minEgpInput = firstString(raw.minEgp).trim();
    maxEgpInput = firstString(raw.maxEgp).trim();
    const min = parseEgpToMinor(minEgpInput);
    const max = parseEgpToMinor(maxEgpInput);
    if (
      (min.ok === false && min.reason === "invalid") ||
      (max.ok === false && max.reason === "invalid")
    ) {
      priceError = PRICE_ERROR;
      priceUrl = "egp";
      page = 1;
    } else {
      minPriceMinor = min.ok ? min.minor : null;
      maxPriceMinor = max.ok ? max.minor : null;
      priceError = rangeError(minPriceMinor, maxPriceMinor);
      if (priceError) {
        page = 1;
      }
      minEgpInput =
        minPriceMinor !== null ? minorToEgpInput(minPriceMinor) : "";
      maxEgpInput =
        maxPriceMinor !== null ? minorToEgpInput(maxPriceMinor) : "";
    }
  } else {
    minPriceRaw = firstString(raw.minPrice).trim();
    maxPriceRaw = firstString(raw.maxPrice).trim();
    const min = parseMinorParam(minPriceRaw);
    const max = parseMinorParam(maxPriceRaw);
    if (min === "invalid" || max === "invalid") {
      priceError = PRICE_ERROR;
      page = 1;
      minEgpInput =
        min === "invalid"
          ? minPriceRaw
          : min === null
            ? ""
            : minorToEgpInput(min);
      maxEgpInput =
        max === "invalid"
          ? maxPriceRaw
          : max === null
            ? ""
            : minorToEgpInput(max);
    } else {
      minPriceMinor = min;
      maxPriceMinor = max;
      priceError = rangeError(minPriceMinor, maxPriceMinor);
      if (priceError) {
        page = 1;
      }
      minEgpInput =
        minPriceMinor !== null ? minorToEgpInput(minPriceMinor) : "";
      maxEgpInput =
        maxPriceMinor !== null ? minorToEgpInput(maxPriceMinor) : "";
    }
  }

  const query: ShopQuery = {
    q,
    categoryId,
    subcategoryId,
    minPriceMinor,
    maxPriceMinor,
    minEgpInput,
    maxEgpInput,
    sort,
    page,
    priceError,
    priceUrl,
    minPriceRaw,
    maxPriceRaw,
  };

  const desired = stablePath(queryFromHref(shopHref(query)));
  const actual = stablePath(actualParams(raw));
  const redirectTo =
    actual !== desired || hasUnknownParam(raw) ? shopHref(query) : null;

  return { query, redirectTo };
}
