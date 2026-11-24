import { createClient } from "npm:@supabase/supabase-js@2.98.0";
import { connectionSiteOrigin, integrationOrigins } from "../_shared/integration-origins.ts";
import { createInstacasterHandler } from "./handler.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

Deno.serve(createInstacasterHandler(async token => {
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return "unauthorized";
  const access = await db.rpc("avanca_user_access", { p_user: user.id });
  if (access.error) throw new Error("access_check_failed");
  return access.data?.is_admin === true && access.data.account_status === "approved" ? "admin" : "forbidden";
}, Deno.env.get("INSTACASTER_API_KEY")?.trim(), integrationOrigins(
  Deno.env.get("AVANCA_EXTRA_ORIGINS"),
  connectionSiteOrigin(Deno.env.get("AVANCA_SITE_ORIGIN")),
)));
