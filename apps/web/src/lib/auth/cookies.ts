import { cookies } from "next/headers";

import { isPlausibleJwt, sessionMaxAgeSeconds } from "./jwt";

/**
 * Express does not set this cookie. Cookie auth, cookie-parser, and refresh
 * tokens were removed from the API. The BFF stores the Bearer JWT here after
 * Express returns data.token. Browser JavaScript cannot read it.
 */
export const SESSION_COOKIE = "nesma_session";

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

type CookieResponse = {
  cookies: {
    set: (
      name: string,
      value: string,
      options: ReturnType<typeof sessionCookieOptions>,
    ) => void;
  };
};

export function attachSession(response: CookieResponse, token: string): boolean {
  if (!isPlausibleJwt(token)) {
    return false;
  }
  const maxAge = sessionMaxAgeSeconds(token);
  if (maxAge <= 0) {
    return false;
  }
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  return true;
}

export function clearSession(response: CookieResponse): void {
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
}

export async function readSessionToken(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIE)?.value;
  if (!value) {
    return null;
  }
  return value;
}
