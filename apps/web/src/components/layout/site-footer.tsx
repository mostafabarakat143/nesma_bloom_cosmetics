import Image from "next/image";
import Link from "next/link";

const socials = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/",
    icon: InstagramIcon,
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/",
    icon: FacebookIcon,
  },
  {
    label: "WhatsApp",
    href: "https://wa.me/",
    icon: WhatsAppIcon,
  },
] as const;

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

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:flex-row sm:items-end sm:justify-between">
        <Link
          href="/"
          className="inline-flex flex-col items-start rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-deep"
        >
          <Image
            src="/brand-logo.png"
            alt="Lamsa"
            width={700}
            height={734}
            className="h-36 w-auto object-contain sm:h-40"
          />
          <span className="mt-3 text-[0.68rem] tracking-[0.14em] text-muted uppercase">
            Natural beauty & fragrance
          </span>
        </Link>
        <div className="flex flex-col items-start gap-4 sm:items-end">
          <ul className="flex items-center gap-2">
            {socials.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    className="inline-flex size-11 items-center justify-center rounded-full border border-line text-rose-deep hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
                  >
                    <Icon />
                  </a>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-muted">
            © 2026 Lamsa. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
