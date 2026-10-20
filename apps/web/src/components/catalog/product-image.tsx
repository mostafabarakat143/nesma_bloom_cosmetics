"use client";

import { useState } from "react";

import { isDisplayableImageUrl } from "@/components/catalog/image-text-tone";

type ProductImageProps = {
  url: string | null;
  alt: string;
  crossOrigin?: "" | "anonymous" | "use-credentials";
  onLoad?: (img: HTMLImageElement) => void;
  onFailed?: () => void;
};

export function ProductImage({
  url,
  alt,
  crossOrigin,
  onLoad,
  onFailed,
}: ProductImageProps) {
  const safeUrl = url && isDisplayableImageUrl(url) ? url : null;
  const [failed, setFailed] = useState(false);

  if (!safeUrl || failed) {
    return (
      <div
        className="h-full w-full bg-white"
        aria-hidden="true"
        title={alt}
      />
    );
  }

  return (
    // Admin image URLs are arbitrary http(s) hosts. next/image would require a fixed host list.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={safeUrl}
      alt={alt}
      loading="lazy"
      decoding="async"
      crossOrigin={crossOrigin}
      className="h-full w-full object-cover object-center"
      onLoad={(event) => onLoad?.(event.currentTarget)}
      onError={() => {
        setFailed(true);
        onFailed?.();
      }}
    />
  );
}
