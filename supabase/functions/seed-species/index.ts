import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import species from "../_shared/spider-species.json" with { type: "json" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Idempotent: upserts the bundled reference species list into spider_species.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await sb.from("spider_species").upsert(species as never[], { onConflict: "slug" });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ ok: true, count: (species as unknown[]).length }), { headers: cors });
});
