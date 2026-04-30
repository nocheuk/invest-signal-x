import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, ArrowRight } from "lucide-react";

export default function Auth() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(mode === "signup" ? "/onboarding" : "/dashboard");
  };

  return (
    <div className="min-h-screen flex">
      {/* Left visual */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden border-r border-border/40 bg-surface/40">
        <div className="absolute inset-0 ds-grid-bg" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(152_70%_48%/0.18),transparent_60%)]" />
        <div className="relative flex flex-col justify-between p-12 w-full">
          <Logo />
          <div className="space-y-6 max-w-md">
            <div className="font-display text-5xl leading-tight">
              Underwriting-grade intelligence on every UK commercial deal.
            </div>
            <p className="text-muted-foreground">"DealSignal flagged a £6.4m Wakefield estate as a green at 87. We bought it at £6.05m two weeks later."</p>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-xs font-semibold text-primary-foreground">MR</div>
              <div className="text-sm">
                <div className="font-medium">Marcus Reyes</div>
                <div className="text-xs text-muted-foreground">Acquisitions, Northbank Capital</div>
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">© 2026 DealSignal Ltd</div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col">
        <div className="lg:hidden p-6 border-b border-border/40"><Logo /></div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-8">
            <div>
              <h1 className="font-display text-3xl">{mode === "signup" ? "Join early access" : "Welcome back"}</h1>
              <p className="text-sm text-muted-foreground mt-2">
                {mode === "signup" ? "Create your account in 30 seconds." : "Sign in to your DealSignal workspace."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs">Full name</Label>
                  <Input id="name" placeholder="Jane Sterling" className="bg-surface-2 border-border/60" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">Work email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="you@firm.co.uk" className="pl-9 bg-surface-2 border-border/60" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type="password" placeholder="••••••••" className="pl-9 bg-surface-2 border-border/60" />
                </div>
              </div>

              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2 h-11">
                {mode === "signup" ? "Create account" : "Sign in"} <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground">
              {mode === "signup" ? "Already have an account? " : "New here? "}
              <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="text-primary hover:underline">
                {mode === "signup" ? "Sign in" : "Create one"}
              </button>
            </div>

            <div className="text-center">
              <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to homepage</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
