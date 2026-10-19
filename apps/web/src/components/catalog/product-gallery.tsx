"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { ProductImage } from "@/components/catalog/product-image";
import type { CatalogImage } from "@/lib/api/catalog";

export function ProductGallery({
  images,
  name,
}: {
  images: CatalogImage[];
  name: string;
}) {
  const [index, setIndex] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const safeIndex =
    images.length === 0 ? 0 : Math.min(index, images.length - 1);
  const active = images[safeIndex] ?? null;
  const alt = active?.altText?.trim() || name;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (images.length < 2) {
      return;
    }
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = (safeIndex + delta + images.length) % images.length;
    setIndex(next);
    buttons.current[next]?.focus();
  }

  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="absolute inset-0">
          <ProductImage url={active?.url ?? null} alt={alt} />
        </div>
      </div>
      {images.length > 1 ? (
        <>
          <p className="sr-only" aria-live="polite">
            {`Showing image ${safeIndex + 1} of ${images.length}`}
          </p>
          <div
            className="mt-4 flex gap-3 overflow-x-auto"
            role="group"
            aria-label="Product images"
            onKeyDown={onKeyDown}
          >
            {images.map((image, imageIndex) => {
              const selected = imageIndex === safeIndex;
              return (
                <button
                  key={image.id}
                  ref={(node) => {
                    buttons.current[imageIndex] = node;
                  }}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Show image ${imageIndex + 1} of ${images.length}`}
                  onClick={() => setIndex(imageIndex)}
                  className={`relative size-16 shrink-0 overflow-hidden rounded-xl border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep ${
                    selected ? "border-rose-deep" : "border-line"
                  }`}
                >
                  <ProductImage url={image.url} alt="" />
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
