import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
export async function AboutPreview() {
  const t = await getTranslations("home");
  const locale = await getLocale();
  const tracking = locale === "ar" ? "tracking-normal normal-case" : "tracking-[0.16em] uppercase";

  return (
    <section className="bg-surface" aria-labelledby="about-heading">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div>
          <p className={`text-sm text-rose-deep ${tracking}`}>{t("ourHouse")}</p>
          <h2
            id="about-heading"
            className="mt-3 font-display text-4xl leading-tight text-ink sm:text-5xl"
          >
            {t("careSimple")}
          </h2>
        </div>
        <div>
          <p className="text-lg leading-relaxed text-muted">{t("aboutBody")}</p>
          <div className="mt-8">
            <Button href="/about" variant="secondary">
              {t("readStory")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
