"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

import { EgyptFlag, UkFlag } from "./flags";

const locales = [
  { locale: "ar", labelKey: "arabic", Flag: EgyptFlag },
  { locale: "en", labelKey: "english", Flag: UkFlag },
] as const;

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const current = locales.find((item) => item.locale === locale) ?? locales[0];
  const CurrentFlag = current.Flag;

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(next: AppLocale) {
    setOpen(false);
    if (next === locale) {
      return;
    }
    const query = searchParams.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    router.replace(href, { locale: next });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep sm:px-2"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t("language")}
        onClick={() => setOpen((value) => !value)}
      >
        <CurrentFlag className="h-4 w-6 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-line" />
        <span className="hidden sm:inline">{t(current.labelKey)}</span>
        <span className="sm:hidden">{locale === "ar" ? "ع" : "EN"}</span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={t("language")}
          className="absolute end-0 top-full z-50 mt-1 w-44 rounded-2xl border border-line bg-surface p-1.5 shadow-[0_8px_24px_rgb(62_52_46/8%)]"
        >
          {locales.map((item) => {
            const Flag = item.Flag;
            const selected = item.locale === locale;
            return (
              <button
                key={item.locale}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-start text-sm text-ink hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
                onClick={() => choose(item.locale)}
              >
                <Flag className="h-4 w-6 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-line" />
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
