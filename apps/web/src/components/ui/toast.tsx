"use client";

import { Check, CircleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type Tone = "success" | "error";

type ToastItem = {
  id: number;
  message: string;
  tone: Tone;
};

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<(next: ToastItem[]) => void>();
const timers = new Map<number, number>();

function emit() {
  for (const listener of listeners) {
    listener(items);
  }
}

export function dismissToast(id: number) {
  const timer = timers.get(id);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    timers.delete(id);
  }
  items = items.filter((item) => item.id !== id);
  emit();
}

export function showToast(message: string, tone: Tone = "success") {
  for (const timer of timers.values()) {
    window.clearTimeout(timer);
  }
  timers.clear();

  const id = nextId;
  nextId += 1;
  items = [{ id, message, tone }];
  emit();
  timers.set(
    id,
    window.setTimeout(() => {
      dismissToast(id);
    }, 3600),
  );
}

export function Toaster() {
  const t = useTranslations("common");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setToasts);
    setToasts(items);
    return () => {
      listeners.delete(setToasts);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-24 z-[70] flex flex-col items-center gap-2 px-4"
    >
      <style>{`@keyframes lamsa-toast-in{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line bg-surface py-3 ps-3 pe-2 shadow-[0_16px_40px_rgb(62_52_46/14%)]"
          style={{ animation: "lamsa-toast-in 220ms ease-out" }}
        >
          <span
            className={
              toast.tone === "success"
                ? "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-deep text-white"
                : "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-blush text-rose-deep"
            }
          >
            {toast.tone === "success" ? (
              <Check aria-hidden="true" className="size-4" strokeWidth={2.4} />
            ) : (
              <CircleAlert aria-hidden="true" className="size-4" />
            )}
          </span>
          <p className="min-w-0 flex-1 text-sm text-ink">{toast.message}</p>
          <button
            type="button"
            aria-label={t("dismiss")}
            onClick={() => dismissToast(toast.id)}
            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-blush hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
