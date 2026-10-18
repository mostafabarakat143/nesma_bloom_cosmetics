import type { Metadata } from "next";
import Image from "next/image";

import { PageContainer } from "@/components/layout/page-container";

export const metadata: Metadata = {
  title: "About",
  description: "The story, ritual, and collection of Lamsa.",
};

const practices = [
  {
    title: "A gentle touch",
    text: "Creams and oils are made to be warmed in the hands before they meet the skin.",
  },
  {
    title: "A short routine",
    text: "Cleanser, mist, serum, facial oil, and moisture cream. Each has a place in the morning or the evening.",
  },
  {
    title: "Natural beauty",
    text: "Soft florals, warm gold, and a light finish. The same feeling runs through the fragrance and the care.",
  },
];

export default function AboutPage() {
  return (
    <PageContainer>
      <section className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm tracking-[0.16em] text-rose-deep uppercase">The house</p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-ink sm:text-5xl">
            About Lamsa
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            Lamsa is a skincare and fragrance house. The name means a touch,
            and the work starts there: formulas you can feel, a gold floral
            mark, and a routine quiet enough for every day.
          </p>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-line">
          <Image
            src="/about-ritual.jpg"
            alt="Hands holding an open Lamsa cream jar, with dropper bottles and flowers on marble"
            fill
            priority
            sizes="(min-width: 1024px) 36rem, 100vw"
            className="object-cover"
          />
        </div>
      </section>

      <ul className="mt-12 grid gap-6 md:grid-cols-3">
        {practices.map((item) => (
          <li key={item.title} className="rounded-[1.5rem] border border-line bg-surface p-6">
            <h2 className="font-display text-3xl text-ink">{item.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{item.text}</p>
          </li>
        ))}
      </ul>

      <section className="mt-16 grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-line">
          <Image
            src="/about-line.jpg"
            alt="The Lamsa skincare line: cleanser, essence mist, facial oil, moisture cream, and hyaluronic serum"
            fill
            sizes="(min-width: 1024px) 36rem, 100vw"
            className="object-cover"
          />
        </div>
        <div>
          <p className="text-sm tracking-[0.16em] text-rose-deep uppercase">The collection</p>
          <h2 className="mt-3 font-display text-4xl text-ink sm:text-5xl">
            Five pieces, one ritual
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            Radiant Glow Cleanser, Hydrating Essence Mist, Brightening Facial
            Oil, Renewing Moisture Cream, and Hyaluronic Acid Serum. Every
            bottle carries the Lamsa mark, and every formula is meant to be
            used, not only displayed.
          </p>
        </div>
      </section>
    </PageContainer>
  );
}
