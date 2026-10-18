"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { SAME_ORIGIN_HEADER, SAME_ORIGIN_VALUE } from "@/lib/auth/origin";

/** Clears a cookie Express has already rejected. Runs once per mount. */
export function SessionCleaner() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;

    void (async () => {
      try {
        const response = await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            accept: "application/json",
            [SAME_ORIGIN_HEADER]: SAME_ORIGIN_VALUE,
          },
          cache: "no-store",
        });
        if (response.status === 503) {
          router.push("/login?notice=revoke-unconfirmed");
          return;
        }
        router.refresh();
      } catch {
        router.refresh();
      }
    })();
  }, [router]);

  return null;
}
