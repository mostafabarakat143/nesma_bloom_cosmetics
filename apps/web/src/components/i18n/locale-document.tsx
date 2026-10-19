"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";

/** The root document stays mounted, so direction follows the active locale. */
export function LocaleDocument() {
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  return null;
}
