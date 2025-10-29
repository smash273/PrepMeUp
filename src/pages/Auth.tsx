import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

type AuthMode = "login" | "signup" | "verify-otp" | "forgot-password" | "reset-password";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const VIT_EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@vitstudent\.ac\.in$/i;
  const normalizeEmail = (value: string) => value.trim().toLowerCase();

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const normalizedEmail = normalizeEmail(email);

    if (!VIT_EMAIL_REGEX.test(normalizedEmail)) {
      toast({
        variant: "destructive",
        title: "Invalid email domain",
        description: "Please use your VIT student email (…@vitstudent.ac.in).",
      });
      setLoading(false);
      return;
    }

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: crypto.randomUUID(), // Random password as we're using OTP
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });

        if (error) throw error;

        // Send OTP
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            shouldCreateUser: false,
          },
        });

        if (otpError) throw otpError;

        toast({
          title: "Verification code sent!",
          description: "Please check your email for the OTP code.",
        });
        setMode("verify-otp");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            shouldCreateUser: false,
          },
        });

        if (error) throw error;

        toast({
          title: "Verification code sent!",
          description: "Please check your email for the OTP code.",
        });
        setMode("verify-otp");
      } else if (mode === "forgot-password") {
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: `${window.location.origin}/auth`,
        });

        if (error) throw error;

        toast({
          title: "Reset link sent!",
          description: "Please check your email for the password reset link.",
        });
        setMode("login");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const normalizedEmail = normalizeEmail(email);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: otp,
        type: "email",
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "You've been logged in successfully.",
      });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Invalid OTP",
        description: error.message || "Please check your code and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    const normalizedEmail = normalizeEmail(email);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) throw error;

      toast({
        title: "Code resent!",
        description: "Please check your email for the new OTP code.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setFullName("");
    setOtp("");
    setMode("login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-purple-900 to-background p-4">
      <Card className="w-full max-w-md p-8 bg-card/95 backdrop-blur">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">PrepMeUp</h1>
          <p className="text-muted-foreground">
            {mode === "signup" && "Create your account"}
            {mode === "login" && "Welcome back"}
            {mode === "verify-otp" && "Enter verification code"}
            {mode === "forgot-password" && "Reset your password"}
          </p>
        </div>

        {mode === "verify-otp" ? (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="text-center text-2xl tracking-widest"
              />
              <p className="text-xs text-muted-foreground">
                Code sent to {email}
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              variant="hero"
              disabled={loading || otp.length !== 6}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Continue"
              )}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={resetForm}
                className="text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={loading}
                className="text-primary hover:underline"
              >
                Resend code
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSendOTP} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Enter your full name"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={(e) => setEmail(normalizeEmail(e.target.value))}
                required
                placeholder="yourname@vitstudent.ac.in"
                pattern="^[A-Za-z0-9._%+-]+@vitstudent\.ac\.in$"
                title="Use your VIT student email (…@vitstudent.ac.in)"
                autoComplete="email"
              />
              <p className="text-xs text-muted-foreground">
                Only VIT student emails are allowed.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              variant="hero"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending code...
                </>
              ) : mode === "forgot-password" ? (
                "Send Reset Link"
              ) : (
                "Send Verification Code"
              )}
            </Button>
          </form>
        )}

        {mode !== "verify-otp" && (
          <div className="mt-6 space-y-3 text-center">
            {mode === "login" && (
              <>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="text-sm text-primary hover:underline block w-full"
                >
                  Don't have an account? Sign up
                </button>
                <button
                  type="button"
                  onClick={() => setMode("forgot-password")}
                  className="text-sm text-muted-foreground hover:text-primary block w-full"
                >
                  Forgot password?
                </button>
              </>
            )}
            {mode === "signup" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-sm text-primary hover:underline"
              >
                Already have an account? Sign in
              </button>
            )}
            {mode === "forgot-password" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-sm text-primary hover:underline flex items-center justify-center gap-1"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
