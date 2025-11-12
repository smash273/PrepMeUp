import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerificationRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: VerificationRequest = await req.json();
    console.log("Generating verification code for:", email);

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Calculate expiration (2 minutes from now)
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    // Initialize Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Store verification code
    const { error: dbError } = await supabaseAdmin
      .from("verification_codes")
      .insert({
        email,
        code,
        expires_at: expiresAt,
        used: false,
      });

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to store verification code");
    }

    // Send email using Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "PrepMeUp <onboarding@resend.dev>",
        to: [email],
        subject: "Your Verification Code - PrepMeUp",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Verify Your Email</h1>
            <p style="font-size: 16px; color: #666;">Welcome to PrepMeUp! Please use the following verification code to complete your registration:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 30px 0; border-radius: 8px;">
              <h2 style="color: #333; font-size: 32px; letter-spacing: 8px; margin: 0;">${code}</h2>
            </div>
            <p style="font-size: 14px; color: #999;">This code will expire in 2 minutes.</p>
            <p style="font-size: 14px; color: #999;">If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      }),
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      console.error("Resend API error:", error);
      throw new Error("Failed to send verification email");
    }

    console.log("Email sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Verification code sent" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-verification-code function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
