import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";

export default function Auth() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: string } | null)?.from || "/dashboard";
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  useEffect(() => {
    if (params.get("confirmed")) setMessage("Email confirmed. You can sign in now.");
    if (params.get("reset")) setMessage("Check your email to continue password recovery.");
  }, [params]);

  useEffect(() => {
    if (auth.user && mode !== "forgot") navigate(from, { replace: true });
  }, [auth.user, from, mode, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      if (!auth.isConfigured) {
        navigate(mode === "signup" ? "/onboarding" : "/dashboard");
        return;
      }

      if (mode === "forgot") {
        await auth.resetPassword(email);
        setMessage("Password reset email sent. Follow the secure link in your inbox.");
        return;
      }

      if (mode === "signup") {
        const result = await auth.signUp(email, password, name);
        if (result.needsConfirmation) {
          setMessage("Account created. Please confirm your email before signing in.");
          setMode("signin");
        } else {
          navigate("/onboarding", { replace: true });
        }
        return;
      }

      await auth.signIn(email, password);
      navigate(from, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await auth.resendConfirmation(email);
      setMessage("Confirmation email resent. Check your inbox and spam folder.");
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Could not resend confirmation email.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-1/2 relative overflow-hidden border-r border-border/40 bg-surface/40">
        <div className="absolute inset-0 ds-grid-bg" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(152_70%_48%/0.18),transparent_60%)]" />
        <div className="relative flex flex-col justify-between p-12 w-full">
          <Logo />
          <div className="space-y-6 max-w-md">
            <div className="font-display text-5xl leading-tight">
              Underwriting-grade intelligence on every UK commercial deal.
            </div>
            <p className="text-muted-foreground">"DealSignal flagged a GBP 6.4m Wakefield estate as a green at 87. We bought it at GBP 6.05m two weeks later."</p>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-xs font-semibold text-primary-foreground">MR</div>
              <div className="text-sm">
                <div className="font-medium">Marcus Reyes</div>
                <div className="text-xs text-muted-foreground">Acquisitions, Northbank Capital</div>
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">2026 DealSignal Ltd</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="lg:hidden p-6 border-b border-border/40"><Logo /></div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-8">
            <div>
              <h1 className="font-display text-3xl">
                {mode === "signup" ? "Join early access" : mode === "forgot" ? "Reset password" : "Welcome back"}
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                {mode === "signup" ? "Create your account in 30 seconds." : mode === "forgot" ? "We'll send a secure recovery link." : "Sign in to your DealSignal workspace."}
              </p>
            </div>

            {(message || error) && (
              <div className={`rounded-lg border px-3 py-2 text-sm ${error ? "border-signal-red/40 bg-signal-red/10 text-signal-red" : "border-primary/40 bg-primary/10 text-foreground"}`}>
                {error || message}
                {message?.includes("confirm") && email && (
                  <button type="button" onClick={() => void handleResend()} className="ml-2 text-primary hover:underline">
                    Resend
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs">Full name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Sterling" className="bg-surface-2 border-border/60" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">Work email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="you@firm.co.uk" className="pl-9 bg-surface-2 border-border/60" />
                </div>
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} placeholder="Password" className="pl-9 bg-surface-2 border-border/60" />
                  </div>
                </div>
              )}

              {mode === "signin" && (
                <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">
                  Forgot password?
                </button>
              )}

              <Button type="submit" disabled={submitting || auth.loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2 h-11">
                {submitting || auth.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"} <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground">
              {mode === "signup" ? "Already have an account? " : mode === "forgot" ? "Remembered it? " : "New here? "}
              <button onClick={() => setMode(mode === "signup" || mode === "forgot" ? "signin" : "signup")} className="text-primary hover:underline">
                {mode === "signup" || mode === "forgot" ? "Sign in" : "Create one"}
              </button>
            </div>

            <div className="text-center">
              <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">Back to homepage</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
