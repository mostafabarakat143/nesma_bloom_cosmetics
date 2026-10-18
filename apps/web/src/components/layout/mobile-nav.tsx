"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import type { AccountView } from "@/lib/auth/account-view";
import { mainNav } from "@/lib/navigation";

import { AccountNav } from "./account-nav";

export function MobileNav({
  account,
  unavailable,
}: {
  account: AccountView | null;
  unavailable: boolean;
}) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const root = rootRef.current;
    const button = buttonRef.current;
    if (!root) {
      return;
    }

    const getItems = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
      );

    const frame = window.requestAnimationFrame(() => {
      const items = getItems();
      const firstLink = items.find((item) => item.tagName === "A");
      (firstLink ?? items[0])?.focus();
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpenPath(null);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const items = getItems();
      if (items.length === 0) {
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      button?.focus();
    };
  }, [open]);

  return (
    <div ref={rootRef} className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex size-11 items-center justify-center rounded-2xl text-ink hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
        aria-expanded={open}
        aria-controls="mobile-navigation"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpenPath(open ? null : pathname)}
      >
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-[rgb(52_42_46/0.28)]"
          onClick={() => setOpenPath(null)}
        >
          <nav
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 top-20 border-b border-line bg-surface px-5 py-6 shadow-[0_8px_24px_rgb(62_52_46/6%)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p id={titleId} className="sr-only">
              Mobile navigation
            </p>
            <ul className="flex flex-col gap-1">
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-2xl px-3 py-3 text-base text-ink hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
                    aria-current={pathname === item.href ? "page" : undefined}
                    onClick={() => {
                      if (item.href === pathname) {
                        setOpenPath(null);
                      }
                    }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="mt-4 border-t border-line pt-4">
                <AccountNav
                  account={account}
                  unavailable={unavailable}
                  layout="menu"
                  onCloseCurrent={() => setOpenPath(null)}
                />
              </li>
            </ul>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
