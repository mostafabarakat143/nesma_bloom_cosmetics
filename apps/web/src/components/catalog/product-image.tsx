"use client";

import { useState } from "react";

type ProductImageProps = {
  url: string | null;
  alt: string;
};

function isDisplayableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function ProductImage({ url, alt }: ProductImageProps) {
  const safeUrl = url && isDisplayableUrl(url) ? url : null;
  const [failed, setFailed] = useState(false);

  if (!safeUrl || failed) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-blush p-6 text-center"
        aria-hidden="true"
      >
        <span className="font-display text-3xl leading-tight text-rose-deep">
          {alt}
        </span>
      </div>
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
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}
