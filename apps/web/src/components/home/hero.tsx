import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

export async function Hero() {
  const t = await getTranslations("home");
  const brand = await getTranslations("common");
  const locale = await getLocale();
  const track = locale === "ar" ? "tracking-normal normal-case" : "uppercase tracking-[0.22em] sm:tracking-[0.28em]";
  const itemTrack = locale === "ar" ? "tracking-normal normal-case" : "uppercase tracking-[0.08em] sm:tracking-[0.14em]";
  const highlights = [
    { label: t("perfumes"), icon: icons.perfume },
    { label: t("candles"), icon: icons.candle },
    { label: t("skin"), icon: icons.care },
    { label: t("hair"), icon: icons.hair },
    { label: t("natural"), icon: icons.bloom },
  ];

  return (
    <section className="relative isolate overflow-hidden bg-[#f6efe6]" aria-labelledby="hero-heading">
      <Image
        src="/hero-bg.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="relative flex min-h-[46rem] flex-col items-center justify-center px-4 py-12 text-center sm:min-h-[40rem] sm:px-6 sm:py-16 lg:min-h-[44rem]">
        <h1 id="hero-heading" className="sr-only">
          {brand("brand")}
        </h1>
        <Image
          src="/brand-logo.png"
          alt=""
          width={700}
          height={734}
          className="h-44 w-auto object-contain sm:h-56 lg:h-64"
        />
        <p className="mt-4 font-display text-2xl text-[#6d5330] sm:mt-5 sm:text-3xl">
          {t("bloom")}
        </p>
        <p className={`mt-4 text-sm text-rose-deep sm:text-base ${track}`}>
          {brand("tagline")}
        </p>
        <ul className="mt-6 grid w-full max-w-4xl grid-cols-5 text-[#8d5a62] sm:mt-8">
          {highlights.map((item, index) => {
            const Icon = item.icon;
            return (
              <li
                key={item.label}
                className={`flex flex-col items-center px-1 sm:px-4 ${
                  index > 0 ? "border-s border-[#c9a097]/80" : ""
                }`}
              >
                <Icon />
                <span className={`mt-2 text-[0.58rem] leading-tight sm:mt-3 sm:text-xs ${itemTrack}`}>
                  {item.label}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-6 sm:mt-8">
          <Button href="/shop" className="h-9! w-44 sm:w-56">
            {t("shopNow")}
          </Button>
        </div>
      </div>
    </section>
  );
}
