// Shared exact-origin policy for the AVANÇA connection and integration APIs.
export const AVANCA_SITE_ORIGIN = "https://organizafy-freitasdxvi.vercel.app";
const DEFAULT_SITE = AVANCA_SITE_ORIGIN;
function exactOrigin(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash || url.port || !/^[a-z0-9.-]+$/i.test(url.hostname)) throw new Error();
    return url.origin;
  } catch {
    throw new Error("invalid_integration_origin");
  }
}
/** Server configuration only. Never use a request parameter as a redirect origin. */
export function connectionSiteOrigin(configured?: string): string {
  return configured?.trim() ? exactOrigin(configured.trim()) : DEFAULT_SITE;
}
export function integrationOrigins(extra?: string, site = DEFAULT_SITE): Set<string> {
  const values = extra?.split(",").map(value => value.trim()).filter(Boolean) || [];
  if (values.length > 20) throw new Error("invalid_integration_origin");
  return new Set([exactOrigin(site), ...values.map(exactOrigin)]);
}
