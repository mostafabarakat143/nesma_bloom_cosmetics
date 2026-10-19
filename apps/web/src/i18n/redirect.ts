import { getLocale } from "next-intl/server";

import { redirect } from "./navigation";
import { splitLocaleHref } from "./pathname";

/** Locale-aware redirect. A stored `/ar/...` or `/en/...` path is not prefixed twice. */
export async function redirectTo(href: string): Promise<never> {
  const split = splitLocaleHref(href);
  const locale = split.locale ?? (await getLocale());
  redirect({ href: split.href, locale });
  throw new Error("Redirect did not complete");
}
