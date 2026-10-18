"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { isUsableResetToken } from "@/lib/auth/credentials";

const ResetTokenContext = createContext("");

export function ResetTokenCapture({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const router = useRouter();
  const urlToken = params.get("token")?.trim() ?? "";
  const [token, setToken] = useState(urlToken);

  if (urlToken && urlToken !== token) {
    setToken(urlToken);
  }

  useEffect(() => {
    if (!urlToken) {
      return;
    }
    router.replace("/reset-password", { scroll: false });
  }, [router, urlToken]);

  const captured = urlToken || token;
  return (
    <ResetTokenContext.Provider value={isUsableResetToken(captured) ? captured : ""}>
      {children}
    </ResetTokenContext.Provider>
  );
}

export function useResetToken(): string {
  return useContext(ResetTokenContext);
}
