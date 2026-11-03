"use client";

import { ErrorMessage } from "@/components/ui/error-message";

import { useLogoutButton } from "@/features/auth/hooks/use-logout-button";


const buttonClass = {
  inline:
    "rounded-md text-sm text-rose-deep hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-deep disabled:opacity-60",
  row: "block w-full rounded-xl px-3 py-2 text-start text-sm text-rose-deep hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep disabled:opacity-60",
  menu: "block w-full rounded-2xl px-3 py-3 text-start text-base text-rose-deep hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep disabled:opacity-60",
} as const;

export function LogoutButton({
  onDone,
  className = "",
  appearance = "inline",
}: {
  onDone?: () => void;
  className?: string;
  appearance?: keyof typeof buttonClass;
}) {
  const { t, pending, message, logout } = useLogoutButton({ onDone });

  return (
    <div className={className} role={appearance === "row" ? "none" : undefined}>
      <button
        type="button"
        role={appearance === "row" ? "menuitem" : undefined}
        onClick={() => void logout()}
        disabled={pending}
        className={buttonClass[appearance]}
      >
        {pending ? t("loggingOut") : t("logout")}
      </button>
      <ErrorMessage message={message} className="mt-1 max-w-48 text-sm text-rose-deep" />
    </div>
  );
}
