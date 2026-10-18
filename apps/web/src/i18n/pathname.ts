const LOCALE_PREFIX = /^\/(ar|en)(?=\/|\?|#|$)/;

/** Removes a leading locale segment so next-intl does not prefix it twice. */
export function splitLocaleHref(href: string): {
  href: string;
  locale?: "ar" | "en";
} {
  const match = LOCALE_PREFIX.exec(href);
  if (!match) {
    return { href };
  }

  const locale = match[1] === "en" ? "en" : "ar";
  const stripped = href.slice(match[0].length);
  return { href: stripped === "" ? "/" : stripped, locale };
}
