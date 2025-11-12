import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  email: string;
  code: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, code }: VerifyRequest = await req.json();
    console.log("Verifying code for:", email);

    // Initialize Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find valid verification code
    const { data: verificationData, error: fetchError } = await supabaseAdmin
      .from("verification_codes")
      .select("*")
      .eq("email", email)
      .eq("code", code)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !verificationData) {
      console.error("Invalid or expired code:", fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid or expired verification code" 
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Mark code as used
    const { error: updateError } = await supabaseAdmin
      .from("verification_codes")
      .update({ used: true })
      .eq("id", verificationData.id);

    if (updateError) {
      console.error("Error updating verification code:", updateError);
      throw new Error("Failed to mark code as used");
    }

    // Find the user by email and confirm their email
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error("Error fetching users:", userError);
      throw new Error("Failed to find user");
    }

    const user = userData.users.find(u => u.email === email);
    
    if (!user) {
      console.error("User not found for email:", email);
      throw new Error("User not found");
    }

    // Update user to confirm email
    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );

    if (confirmError) {
      console.error("Error confirming user email:", confirmError);
      throw new Error("Failed to confirm email");
    }

    console.log("Verification successful for:", email);

    return new Response(
      JSON.stringify({ success: true, message: "Email verified successfully" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-code function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "Verification failed" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
