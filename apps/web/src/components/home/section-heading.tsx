import { getLocale } from "next-intl/server";

type SectionHeadingProps = {
  id: string;
  eyebrow?: string;
  title: string;
};

export async function SectionHeading({ id, eyebrow, title }: SectionHeadingProps) {
  const locale = await getLocale();
  const tracking = locale === "ar" ? "tracking-normal normal-case" : "tracking-[0.16em] uppercase";

  return (
    <div>
      {eyebrow ? (
        <p className={`text-sm text-rose-deep ${tracking}`}>
          {eyebrow}
        </p>
      ) : null}
      <h2
        id={id}
        className={`${eyebrow ? "mt-2 " : ""}font-display text-4xl leading-tight text-ink sm:text-5xl`}
      >
        {title}
      </h2>
    </div>
  );
}
