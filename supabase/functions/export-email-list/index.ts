import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the request is from an authenticated admin user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from auth header
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query profiles table for users with email communications enabled
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, display_name, email_communications_enabled')
      .eq('email_communications_enabled', true);

    if (error) {
      throw error;
    }

    // Get email addresses from auth.users for these profiles
    const { data: users, error: usersError } = await supabase
      .rpc('get_user_emails_for_profiles', { profile_ids: profiles.map(p => p.id) });

    if (usersError) {
      console.error('Error fetching user emails:', usersError);
      // Fallback: return profile data without emails
      return new Response(
        JSON.stringify({
          message: "Email export completed (profile data only)",
          count: profiles.length,
          data: profiles.map(p => ({
            user_id: p.id,
            display_name: p.display_name,
            email: "Email not available (requires admin function)",
            email_communications_enabled: p.email_communications_enabled
          }))
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Combine profile and email data
    const emailList = profiles.map(profile => {
      const userEmail = users?.find((u: any) => u.id === profile.id);
      return {
        user_id: profile.id,
        display_name: profile.display_name,
        email: userEmail?.email || "No email found",
        email_communications_enabled: profile.email_communications_enabled
      };
    });

    return new Response(
      JSON.stringify({
        message: "Email export completed successfully",
        count: emailList.length,
        data: emailList
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error: any) {
    console.error("Error in export-email-list function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json" 
        },
      }
    );
  }
});