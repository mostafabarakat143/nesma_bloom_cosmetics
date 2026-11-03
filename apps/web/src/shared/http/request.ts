export const SAME_ORIGIN_HEADER = "x-nesma-request";
export const SAME_ORIGIN_VALUE = "same-origin";

const BROWSER_API_PREFIX = "/api";

export function joinApiUrl(base: string, endpoint: string): string {
  return `${base.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;
}

export function getBrowserApiUrl(endpoint: string): string {
  return joinApiUrl(BROWSER_API_PREFIX, endpoint);
}
