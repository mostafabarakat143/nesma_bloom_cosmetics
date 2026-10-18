type SectionHeadingProps = {
  id: string;
  eyebrow?: string;
  title: string;
};

export function SectionHeading({ id, eyebrow, title }: SectionHeadingProps) {
  return (
    <div>
      {eyebrow ? (
        <p className="text-sm tracking-[0.16em] text-rose-deep uppercase">
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
