import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

type AuthMode = "login" | "signup" | "verify-code" | "forgot-password";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const VIT_EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@vitstudent\.ac\.in$/i;
  const normalizeEmail = (value: string) => value.trim().toLowerCase();

  const handleSignup = async (e: React.FormEvent) => {
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
      // Create user account (unconfirmed)
      const { error: signupError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (signupError) throw signupError;

      // Send verification code
      const { error: sendError } = await supabase.functions.invoke("send-verification-code", {
        body: { email: normalizedEmail },
      });

      if (sendError) throw sendError;

      toast({
        title: "Verification Code Sent",
        description: "Please check your email for the 6-digit verification code (expires in 2 minutes)",
      });

      setMode("verify-code");
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: error.message || "An error occurred during signup",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
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
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
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
        title: "Login failed",
        description: error.message || "Invalid email or password.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
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
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/dashboard`,
      });

      if (error) throw error;

      toast({
        title: "Reset link sent!",
        description: "Please check your email for the password reset link.",
      });
      setMode("login");
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

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const normalizedEmail = normalizeEmail(email);

    try {
      // Verify the code via edge function
      const { data, error } = await supabase.functions.invoke("verify-code", {
        body: { email: normalizedEmail, code: verificationCode },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Verification failed");
      }

      toast({
        title: "Email Verified",
        description: "Your email has been verified successfully! Please log in.",
      });

      // Reset form and switch to login
      setMode("login");
      setVerificationCode("");
      setPassword("");
    } catch (error: any) {
      console.error("Verification error:", error);
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: error.message || "Invalid or expired verification code",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    const normalizedEmail = normalizeEmail(email);

    try {
      const { error } = await supabase.functions.invoke("send-verification-code", {
        body: { email: normalizedEmail },
      });

      if (error) throw error;

      toast({
        title: "Code Resent",
        description: "A new verification code has been sent to your email (expires in 2 minutes)",
      });
    } catch (error: any) {
      console.error("Resend error:", error);
      toast({
        variant: "destructive",
        title: "Resend Failed",
        description: error.message || "Failed to resend verification code",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setVerificationCode("");
    setMode("login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-purple-900 to-background p-4">
      <Card className="w-full max-w-md p-8 bg-card/95 backdrop-blur">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">PrepMeUp</h1>
          <p className="text-muted-foreground">
            {mode === "signup" && "Create your account"}
            {mode === "login" && "Sign in to your account"}
            {mode === "verify-code" && "Verify your email"}
            {mode === "forgot-password" && "Reset your password"}
          </p>
        </div>

        {mode === "verify-code" ? (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verificationCode">Verification Code</Label>
              <Input
                id="verificationCode"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
              disabled={loading || verificationCode.length !== 6}
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
                onClick={handleResendCode}
                disabled={loading}
                className="text-primary hover:underline"
              >
                Resend code
              </button>
            </div>
          </form>
        ) : mode === "signup" ? (
          <form onSubmit={handleSignup} className="space-y-4">
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

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Choose a strong password"
                minLength={6}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 6 characters.
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
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
        ) : mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                autoComplete="current-password"
              />
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
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-4">
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
                We'll send you a password reset link.
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
                  Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </form>
        )}

        {mode !== "verify-code" && (
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
                className="text-sm text-primary hover:underline"
              >
                Back to Sign In
              </button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
