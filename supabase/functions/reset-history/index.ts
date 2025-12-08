import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Whitelist of valid tables that can be reset
const ALLOWED_TABLES = [
  'battle_challenges',
  'battles',
  'weekly_rankings',
  'weekly_uploads',
  'matchups',
  'spiders'
] as const;

type AllowedTable = typeof ALLOWED_TABLES[number];

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Require Authorization header (must be a valid user)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optionally parse scope from body (default: reset all)
    const payload = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    let requestedScope: string[] = Array.isArray(payload?.scope) ? payload.scope : [...ALLOWED_TABLES];

    // INPUT VALIDATION: Filter to only allowed tables (whitelist approach)
    const invalidTables = requestedScope.filter(t => !ALLOWED_TABLES.includes(t as AllowedTable));
    if (invalidTables.length > 0) {
      console.warn(`User ${userData.user.id} attempted to reset invalid tables: ${invalidTables.join(', ')}`);
      return new Response(
        JSON.stringify({ 
          error: "Invalid table names in scope",
          invalid_tables: invalidTables,
          allowed_tables: ALLOWED_TABLES
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Ensure scope only contains valid tables
    const scope: AllowedTable[] = requestedScope.filter(
      (t): t is AllowedTable => ALLOWED_TABLES.includes(t as AllowedTable)
    );

    const results: Record<string, { deleted: number | null; error?: string }> = {};

    // Helper to delete all rows from a table and report count
    const wipe = async (table: AllowedTable) => {
      const { error, count } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select('id', { count: 'exact', head: true });
      results[table] = { deleted: count ?? null, error: error?.message };
    };

    for (const table of scope) {
      await wipe(table);
    }

    console.log(`User ${userData.user.id} reset tables: ${scope.join(', ')}`);

    return new Response(
      JSON.stringify({ message: 'Reset completed', results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error('Error in reset-history function:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
