import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

type AuthMode = "login" | "signup" | "forgot-password";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const normalizeEmail = (value: string) => value.trim().toLowerCase();

  const isValidEmail = (email: string): boolean => {
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      toast({
        variant: "destructive",
        title: "Invalid email",
        description: "Please enter a valid email address.",
      });
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Password must be at least 6 characters.",
      });
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;

      toast({
        title: "Confirmation email sent!",
        description: "Please check your email and click the confirmation link to activate your account.",
      });
      resetForm();
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      toast({
        variant: "destructive",
        title: "Invalid email",
        description: "Please enter a valid email address.",
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

    if (!isValidEmail(normalizedEmail)) {
      toast({
        variant: "destructive",
        title: "Invalid email",
        description: "Please enter a valid email address.",
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

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
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
            {mode === "forgot-password" && "Reset your password"}
          </p>
        </div>

        {mode === "signup" ? (
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
                placeholder="yourname@example.com"
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
                placeholder="yourname@example.com"
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
                placeholder="yourname@example.com"
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
      </Card>
    </div>
  );
}
