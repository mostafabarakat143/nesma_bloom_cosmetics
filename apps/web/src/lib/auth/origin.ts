export const SAME_ORIGIN_HEADER = "x-nesma-request";
export const SAME_ORIGIN_VALUE = "same-origin";

export function isTrustedMutation(request: Request): boolean {
  if (request.headers.get(SAME_ORIGIN_HEADER) !== SAME_ORIGIN_VALUE) {
    return false;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  if (originUrl.origin === new URL(request.url).origin) {
    return true;
  }

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return Boolean(host) && originUrl.host === host;
}
