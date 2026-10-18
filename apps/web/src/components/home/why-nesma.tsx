const reasons = [
  {
    title: "A calm routine",
    body: "Care meant for the morning and the evening, without a crowded shelf.",
  },
  {
    title: "Thoughtful formulas",
    body: "Each product is there to sit simply in a daily ritual.",
  },
  {
    title: "Quiet luxury",
    body: "Soft color, clear type, and room to breathe around every detail.",
  },
] as const;

export function WhyNesma() {
  return (
    <section
      className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20"
      aria-labelledby="why-heading"
    >
      <h2
        id="why-heading"
        className="max-w-xl font-display text-4xl leading-tight text-ink sm:text-5xl"
      >
        Why Lamsa
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
