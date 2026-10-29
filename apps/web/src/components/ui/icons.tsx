const iconClass = "size-8 sm:size-11";

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

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
      <path
        fill="currentColor"
        d="M15 8.5h2.2V5.6h-2.5C12.1 5.6 11 7 11 9.2v1.6H8.8v2.8H11V21h3.1v-7.4h2.4l.4-2.8h-2.8V9.4c0-.6.4-.9 1-.9z"
      />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.04 3.2A8.7 8.7 0 0 0 4.6 16.3L3.6 20.4l4.2-1.1a8.8 8.8 0 0 0 4.24 1.08h.01a8.72 8.72 0 0 0 0-17.18zm5.08 12.28c-.22.62-1.28 1.18-1.78 1.26-.46.07-1.04.1-1.68-.1-.39-.13-.88-.29-1.52-.56-2.67-1.15-4.4-3.84-4.54-4.02-.13-.17-1.08-1.44-1.08-2.75 0-1.3.68-1.94.93-2.2.24-.27.53-.33.7-.33h.5c.16 0 .38-.06.6.46.23.53.75 1.83.82 1.97.07.13.11.28.02.46-.08.17-.13.28-.26.44-.13.15-.27.34-.38.46-.13.13-.26.27-.11.51.15.25.66 1.09 1.42 1.77.98.87 1.8 1.14 2.06 1.27.26.13.4.11.55-.06.16-.17.64-.74.81-1 .17-.25.34-.21.57-.13.23.08 1.5.7 1.75.83.26.13.43.19.5.3.06.11.06.62-.16 1.24z"
      />
    </svg>
  );
}

export const icons = {
  perfume: PerfumeIcon,
  candle: CandleIcon,
  care: CareIcon,
  hair: HairIcon,
  bloom: BloomIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  whatsapp: WhatsAppIcon,
} as const;
