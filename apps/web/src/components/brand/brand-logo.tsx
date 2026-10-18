import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";

export async function BrandLockup() {
  const t = await getTranslations("common");
  const locale = await getLocale();
  const tracking = locale === "ar" ? "tracking-normal normal-case" : "tracking-[0.16em] uppercase";

  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Image
        src="/brand-logo.png"
        alt={t("brand")}
        width={700}
        height={734}
        priority
        className="h-14 w-auto shrink-0 object-contain sm:h-16"
      />
      <span className={`hidden text-xs whitespace-nowrap text-muted sm:block ${tracking}`}>
        {t("tagline")}
      </span>
    </span>
  );
}
