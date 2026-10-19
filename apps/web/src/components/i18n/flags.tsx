import { useId } from "react";

export function EgyptFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 40" className={className} aria-hidden="true">
      <rect width="60" height="13.34" fill="#CE1126" />
      <rect y="13.34" width="60" height="13.32" fill="#FFFFFF" />
      <rect y="26.66" width="60" height="13.34" fill="#000000" />
      <circle cx="30" cy="20" r="4.2" fill="#C09300" />
    </svg>
  );
}

export function UkFlag({ className }: { className?: string }) {
  const clipId = useId();
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect width="60" height="30" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="60" height="30" fill="#012169" />
        <path d="M0 0 L60 30 M60 0 L0 30" stroke="#FFFFFF" strokeWidth="6" />
        <path d="M0 0 L60 30 M60 0 L0 30" stroke="#C8102E" strokeWidth="2.4" />
        <path d="M30 0 V30 M0 15 H60" stroke="#FFFFFF" strokeWidth="10" />
        <path d="M30 0 V30 M0 15 H60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}
