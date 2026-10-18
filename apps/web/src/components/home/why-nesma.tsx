import { getTranslations } from "next-intl/server";

export async function WhyNesma() {
  const t = await getTranslations("home");
  const reasons = [
    { title: t("calmTitle"), body: t("calmBody") },
    { title: t("formulasTitle"), body: t("formulasBody") },
    { title: t("luxuryTitle"), body: t("luxuryBody") },
  ];

  return (
    <section
      className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20"
      aria-labelledby="why-heading"
    >
      <h2
        id="why-heading"
        className="max-w-xl font-display text-4xl leading-tight text-ink sm:text-5xl"
      >
        {t("whyTitle")}
      </h2>
      <ul className="mt-10 grid gap-5 md:grid-cols-3">
        {reasons.map((reason) => (
          <li
            key={reason.title}
            className="rounded-2xl border border-line bg-blush/70 p-6"
          >
            <h3 className="font-display text-3xl text-ink">{reason.title}</h3>
            <p className="mt-3 leading-relaxed text-muted">{reason.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
