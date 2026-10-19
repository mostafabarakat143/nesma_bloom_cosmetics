type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PlaceholderPage({
  eyebrow,
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <section className="max-w-2xl">
      <p className="text-sm tracking-[0.16em] text-rose-deep uppercase">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-display text-5xl leading-tight text-ink sm:text-6xl">
        {title}
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-muted">{description}</p>
    </section>
  );
}
