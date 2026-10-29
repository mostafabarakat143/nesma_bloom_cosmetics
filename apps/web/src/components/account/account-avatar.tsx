"use client";

import { useState } from "react";

const sizeClass = {
  sm: "size-8 text-xs",
  lg: "size-20 text-xl",
} as const;

export function AccountAvatar({
  initials,
  avatarUrl,
  size = "sm",
}: {
  initials: string;
  avatarUrl: string | null;
  size?: keyof typeof sizeClass;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = avatarUrl !== null && failedUrl === avatarUrl;
  const className = `inline-flex ${sizeClass[size]} shrink-0 items-center justify-center overflow-hidden rounded-full bg-blush font-medium text-rose-deep`;

  if (!avatarUrl || failed) {
    return (
      <span className={className} aria-hidden="true">
        {initials}
      </span>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt=""
      className={`${className} object-cover`}
      onError={() => setFailedUrl(avatarUrl)}
    />
  );
}
