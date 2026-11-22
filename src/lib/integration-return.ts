// TypeScript / integration-return.ts / browser / bounded companion sign-in handoff
export function integrationReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 200) return "/persiste";
  try {
    const url = new URL(value, "https://local.invalid");
    const isIntegration = url.pathname === "/persiste/integracao" || url.pathname === "/avanca/integracao";
    if (!value.startsWith("/") || value.startsWith("//") || url.origin !== "https://local.invalid" || !isIntegration || url.hash) return "/persiste";
    const username = (url.searchParams.get("expected_username") || "").trim().replace(/^@/, "").toLowerCase();
    return "/persiste/integracao" + (/^[a-z0-9._]{1,30}$/.test(username) ? `?expected_username=${encodeURIComponent(username)}` : "");
  } catch { return "/persiste"; }
}
