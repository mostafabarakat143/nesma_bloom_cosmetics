import Image from "next/image";

import { Button } from "@/components/ui/button";

const highlights = [
  { label: "Perfumes", icon: PerfumeIcon },
  { label: "Scented candles", icon: CandleIcon },
  { label: "Skin & body care", icon: CareIcon },
  { label: "Hair care", icon: HairIcon },
  { label: "Natural products", icon: BloomIcon },
] as const;

const iconClass = "size-8 sm:size-11";

export function Hero() {
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
          Lamsa
        </h1>
        <Image
          src="/brand-logo.png"
          alt=""
          width={700}
          height={734}
          className="h-44 w-auto object-contain sm:h-56 lg:h-64"
        />
        <p className="mt-4 font-display text-2xl text-[#6d5330] sm:mt-5 sm:text-3xl">
          Your beauty blooms with lamsa
        </p>
        <p className="mt-4 text-sm tracking-[0.22em] text-rose-deep uppercase sm:text-base sm:tracking-[0.28em]">
          Natural beauty & fragrance
        </p>
        <ul className="mt-6 grid w-full max-w-4xl grid-cols-5 text-[#8d5a62] sm:mt-8">
          {highlights.map((item, index) => {
            const Icon = item.icon;
            return (
              <li
                key={item.label}
                className={`flex flex-col items-center px-1 sm:px-4 ${
                  index > 0 ? "border-l border-[#c9a097]/80" : ""
                }`}
              >
                <Icon />
                <span className="mt-2 text-[0.58rem] leading-tight tracking-[0.08em] uppercase sm:mt-3 sm:text-xs sm:tracking-[0.14em]">
                  {item.label}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-6 sm:mt-8">
          <Button href="/shop" className="h-9! w-44 sm:w-56">
            Shop now
          </Button>
        </div>
      </div>
    </section>
  );
}

function PerfumeIcon() {
  return (
    <svg viewBox="0 0 32 32" className={iconClass} aria-hidden="true" fill="none">
      <path d="M13.5 7.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M14.5 7.5V5.8a1.5 1.5 0 0 1 3 0V7.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="12" y="7.5" width="8" height="3.2" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M12.2 10.7h7.6l1.2 2.8v9.2a2.2 2.2 0 0 1-2.2 2.2h-5.6a2.2 2.2 0 0 1-2.2-2.2v-9.2l1.2-2.8z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CandleIcon() {
  return (
    <svg viewBox="0 0 32 32" className={iconClass} aria-hidden="true" fill="none">
      <path
        d="M16 5.5c1.1 1.7 2.1 2.8 2.1 4.2a2.1 2.1 0 1 1-4.2 0c0-1.4 1-2.5 2.1-4.2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M16 12.2v2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="11.5" y="14.2" width="9" height="11" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function CareIcon() {
  return (
    <svg viewBox="0 0 32 32" className={iconClass} aria-hidden="true" fill="none">
      <rect x="11" y="7.5" width="10" height="3.2" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10.2 12.2h11.6v8.2a3.2 3.2 0 0 1-3.2 3.2h-5.2a3.2 3.2 0 0 1-3.2-3.2v-8.2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M14 17.2h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function HairIcon() {
  return (
    <svg viewBox="0 0 32 32" className={iconClass} aria-hidden="true" fill="none">
      <path
        d="M9.5 7.5c2.2 3.2 1.2 6.4 2.2 16M16 6c1.2 4.2.2 8 1.2 17.5M22.5 7.5c-2.2 3.2-1.2 6.4-2.2 16"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BloomIcon() {
  return (
    <svg viewBox="0 0 32 32" className={iconClass} aria-hidden="true" fill="none">
      <path
        d="M16 23.5c0-5.2 3.4-7.2 3.6-11.2-2.6 2-3.6 4.6-3.6 7.4 0-2.8-1-5.4-3.6-7.4.2 4 3.6 6 3.6 11.2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M16 23.2c-3.4-1.5-6.2-1.4-8.2.8 2.6.2 5.2-.6 8.2-.8 3 .2 5.6 1 8.2.8-2-2.2-4.8-2.3-8.2-.8z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
