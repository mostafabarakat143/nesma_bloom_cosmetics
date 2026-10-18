import Link from "next/link";

import { SessionCleaner } from "@/components/auth/session-cleaner";
import { BrandLockup } from "@/components/brand/brand-logo";
import { toAccountView } from "@/lib/auth/account-view";
import { getAccountProfile } from "@/lib/auth/profile";
import { getVerifiedUser } from "@/lib/auth/session";

import { AccountNav } from "./account-nav";
import { DesktopNav } from "./desktop-nav";
import { MobileNav } from "./mobile-nav";

export async function SiteHeader() {
  const session = await getVerifiedUser();
  const unavailable = session.state === "unavailable";
  const account =
    session.state === "authenticated"
      ? toAccountView(session.user.email, await getAccountProfile())
      : null;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-3 px-5 sm:gap-4">
        <Link
          href="/"
          className="min-w-0 shrink rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-deep"
        >
          <BrandLockup />
        </Link>
        <div className="flex items-center gap-6">
          <DesktopNav />
          <div className={account || unavailable ? "hidden md:block" : undefined}>
            <AccountNav account={account} unavailable={unavailable} layout="bar" />
          </div>
          <MobileNav account={account} unavailable={unavailable} />
        </div>
      </div>
      {session.state === "invalid" ? <SessionCleaner /> : null}
    </header>
  );
}
