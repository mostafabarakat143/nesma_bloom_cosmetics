"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { mainNav } from "@/lib/navigation";

export function DesktopNav() {
  const pathname = usePathname();
  const t = useTranslations("common");

  return (
    <nav aria-label={t("mainNav")} className="hidden items-center gap-6 md:flex">
      {mainNav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={pathname === item.href ? "page" : undefined}
          className="rounded-md text-sm text-ink hover:text-rose-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-deep aria-[current=page]:text-rose-deep"
        >
          {t(item.key)}
        </Link>
      ))}
    </nav>
  );
}
