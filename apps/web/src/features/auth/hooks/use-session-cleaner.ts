"use client";

import { useRouter } from "@/i18n/navigation";
import { useEffect, useRef } from "react";

import { useLogout } from "@/features/auth/hooks/use-auth-mutations";

/** Clears a cookie Express has already rejected. Runs once per mount. */
export function useSessionCleaner() {
  const router = useRouter();
  const { mutateAsync: requestLogout } = useLogout();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;

    void (async () => {
      try {
        const response = await requestLogout();
        if (response.status === 503) {
          router.push("/login?notice=revoke-unconfirmed");
          return;
        }
        router.refresh();
      } catch {
        router.refresh();
      }
    })();
  }, [router, requestLogout]);

}
