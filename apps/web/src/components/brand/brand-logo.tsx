import Image from "next/image";

export function BrandLockup() {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Image
        src="/brand-logo.png"
        alt="Lamsa"
        width={700}
        height={734}
        priority
        className="h-14 w-auto shrink-0 object-contain sm:h-16"
      />
      <span className="hidden text-xs tracking-[0.16em] whitespace-nowrap text-muted uppercase sm:block">
        Natural beauty & fragrance
      </span>
    </span>
  );
}
