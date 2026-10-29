import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";

import { icons } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("common");
  const locale = await getLocale();
  const tracking = locale === "ar" ? "tracking-normal normal-case" : "tracking-[0.14em] uppercase";
  const socials = [
    { label: t("instagram"), href: "https://www.instagram.com/", icon: icons.instagram },
    { label: t("facebook"), href: "https://www.facebook.com/", icon: icons.facebook },
    { label: t("whatsapp"), href: "https://wa.me/", icon: icons.whatsapp },
  ];

  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:flex-row sm:items-end sm:justify-between">
        <Link
          href="/"
          className="inline-flex flex-col items-start rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-deep"
        >
          <Image
            src="/brand-logo.png"
            alt={t("brand")}
            width={700}
            height={734}
            className="h-36 w-auto object-contain sm:h-40"
          />
          <span className={`mt-3 text-[0.68rem] text-muted ${tracking}`}>
            {t("tagline")}
          </span>
        </Link>
        <div className="flex flex-col items-start gap-4 sm:items-end">
          <ul className="flex items-center gap-2">
            {socials.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    className="inline-flex size-11 items-center justify-center rounded-full border border-line text-rose-deep hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
                  >
                    <Icon />
                  </a>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-muted">
            {t("rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
