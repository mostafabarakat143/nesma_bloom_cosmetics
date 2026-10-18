"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { Link, usePathname } from "@/i18n/navigation";

import { AccountAvatar } from "@/components/account/account-avatar";
import { LogoutButton } from "@/components/auth/logout-button";
import type { AccountView } from "@/lib/auth/account-view";

const menuLink =
  "block rounded-2xl px-3 py-3 text-base text-ink hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep";
const loginButton =
  "inline-flex h-10 items-center justify-center rounded-full bg-rose-deep px-4 text-sm font-medium text-white hover:bg-rose-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep";

export function AccountNav({
  account,
  unavailable = false,
  layout,
  onCloseCurrent,
}: {
  account: AccountView | null;
  unavailable?: boolean;
  layout: "bar" | "menu";
  onCloseCurrent?: () => void;
}) {
  const t = useTranslations("common");

  if (unavailable) {
    return (
      <p className={layout === "bar" ? "max-w-48 text-sm text-muted" : "px-3 py-3 text-sm text-muted"}>
        {t("accountUnavailable")}
      </p>
    );
  }

  if (!account) {
    return <SignedOutLinks layout={layout} onCloseCurrent={onCloseCurrent} />;
  }

  if (layout === "menu") {
    return <AccountSummary account={account} onCloseCurrent={onCloseCurrent} />;
  }

  return <AccountMenu account={account} />;
}

function SignedOutLinks({
  layout,
  onCloseCurrent,
}: {
  layout: "bar" | "menu";
  onCloseCurrent?: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("common");

  return (
    <Link
      href="/login"
      className={layout === "menu" ? `${loginButton} w-full` : loginButton}
      aria-current={pathname === "/login" ? "page" : undefined}
      onClick={() => {
        if (pathname === "/login") {
          onCloseCurrent?.();
        }
      }}
    >
      {t("login")}
    </Link>
  );
}

function AccountSummary({
  account,
  onCloseCurrent,
}: {
  account: AccountView;
  onCloseCurrent?: () => void;
}) {
  const t = useTranslations("common");

  return (
    <div className="px-3 py-3">
      <div className="flex items-center gap-3">
        <AccountAvatar initials={account.initials} avatarUrl={account.avatarUrl} />
        <p className="min-w-0 truncate text-base text-ink">{account.fullName}</p>
      </div>
      <Link href="/account" className={`${menuLink} mt-3`} onClick={onCloseCurrent}>
        {t("profile")}
      </Link>
      <LogoutButton appearance="menu" className="mt-1" onDone={onCloseCurrent} />
    </div>
  );
}

function AccountMenu({ account }: { account: AccountView }) {
  const pathname = usePathname();
  const t = useTranslations("common");
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  function closeMenu() {
    setOpenPath(null);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenPath(null);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      setOpenPath(null);
      buttonRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    const frame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? [],
    );
    if (items.length === 0) {
      return;
    }
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === "Tab") {
      closeMenu();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex max-w-36 cursor-pointer flex-col items-center gap-1 rounded-lg px-1 py-0.5 text-center text-xs leading-tight text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpenPath(open ? null : pathname)}
      >
        <AccountAvatar initials={account.initials} avatarUrl={account.avatarUrl} />
        <span className="w-full truncate">{account.fullName}</span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={t("profile")}
          className="absolute end-0 top-full z-50 mt-1 w-40 rounded-2xl border border-line bg-surface p-1.5 shadow-[0_8px_24px_rgb(62_52_46/8%)]"
          onKeyDown={onMenuKeyDown}
        >
          <Link
            href="/account"
            role="menuitem"
            className="block rounded-xl px-3 py-2 text-sm text-ink hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
            onClick={closeMenu}
          >
            {t("profile")}
          </Link>
          <LogoutButton appearance="row" onDone={closeMenu} />
        </div>
      ) : null}
    </div>
  );
}

