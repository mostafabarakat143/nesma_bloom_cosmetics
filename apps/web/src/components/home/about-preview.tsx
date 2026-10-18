import { Button } from "@/components/ui/button";

export function AboutPreview() {
  return (
    <section className="bg-surface" aria-labelledby="about-heading">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div>
          <p className="text-sm tracking-[0.16em] text-rose-deep uppercase">
            Our house
          </p>
          <h2
            id="about-heading"
            className="mt-3 font-display text-4xl leading-tight text-ink sm:text-5xl"
          >
            Care, kept simple
          </h2>
        </div>
        <div>
          <p className="text-lg leading-relaxed text-muted">
            Lamsa is a skincare and cosmetics house. The collection is
            built for a calm routine and a finish that feels considered, not
            loud.
          </p>
          <div className="mt-8">
            <Button href="/about" variant="secondary">
              Read our story
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
