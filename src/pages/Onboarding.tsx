import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSET_TYPES, REGIONS } from "@/lib/deals";
import { ArrowLeft, ArrowRight, Check, Building2, Target, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, title: "Who you are", icon: Building2 },
  { n: 2, title: "What you want", icon: Target },
  { n: 3, title: "How we alert you", icon: Bell },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState("Investor");
  const [regions, setRegions] = useState<string[]>(["South East", "North West"]);
  const [assets, setAssets] = useState<string[]>(["Industrial", "Convenience"]);
  const [riskAppetite, setRiskAppetite] = useState("Balanced");
  const [minYield, setMinYield] = useState(6);
  const navigate = useNavigate();

  const toggle = (arr: string[], setter: (v: string[]) => void, val: string) =>
    setter(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="container h-16 flex items-center justify-between border-b border-border/40">
        <Logo />
        <button onClick={() => navigate("/dashboard")} className="text-xs text-muted-foreground hover:text-foreground">Skip for now</button>
      </header>

      <div className="flex-1 container max-w-3xl py-12">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-12">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center flex-1">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-9 w-9 rounded-full grid place-items-center border transition-colors",
                  step >= s.n ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground"
                )}>
                  {step > s.n ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </div>
                <div className="hidden sm:block">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Step {s.n}</div>
                  <div className="text-sm font-medium">{s.title}</div>
                </div>
              </div>
              {i < STEPS.length - 1 && <div className={cn("flex-1 h-px mx-4", step > s.n ? "bg-primary" : "bg-border")} />}
            </div>
          ))}
        </div>

        <div className="ds-card-elevated p-8 lg:p-10 space-y-8">
          {step === 1 && (
            <>
              <div>
                <h2 className="font-display text-3xl">Tell us who you are.</h2>
                <p className="text-muted-foreground mt-2 text-sm">We'll tailor the deal flow and underwriting style.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Your role</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {["Investor", "Developer", "Sourcer", "Agent"].map((r) => (
                    <button key={r} onClick={() => setRole(r)} className={cn(
                      "px-4 py-3 rounded-lg border text-sm transition-all",
                      role === r ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-border/80"
                    )}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="firm" className="text-xs">Firm or fund name (optional)</Label>
                <Input id="firm" placeholder="e.g. Northbank Capital" className="bg-surface-2 border-border/60" />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2 className="font-display text-3xl">What are you hunting for?</h2>
                <p className="text-muted-foreground mt-2 text-sm">Pick at least one region and asset type. You can change these later.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Preferred regions</Label>
                <div className="flex flex-wrap gap-2">
                  {REGIONS.slice(1).map((r) => (
                    <button key={r} onClick={() => toggle(regions, setRegions, r)} className={cn(
                      "px-3 py-1.5 rounded-full border text-xs transition-all",
                      regions.includes(r) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                    )}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Asset types</Label>
                <div className="flex flex-wrap gap-2">
                  {ASSET_TYPES.map((a) => (
                    <button key={a} onClick={() => toggle(assets, setAssets, a)} className={cn(
                      "px-3 py-1.5 rounded-full border text-xs transition-all",
                      assets.includes(a) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                    )}>{a}</button>
                  ))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Minimum target yield: <span className="font-mono text-primary">{minYield.toFixed(1)}%</span></Label>
                  <input type="range" min={4} max={12} step={0.5} value={minYield} onChange={(e) => setMinYield(+e.target.value)} className="w-full accent-primary" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Risk appetite</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {["Conservative", "Balanced", "Opportunistic"].map((r) => (
                      <button key={r} onClick={() => setRiskAppetite(r)} className={cn(
                        "px-2 py-2 rounded-lg border text-xs transition-all",
                        riskAppetite === r ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                      )}>{r}</button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <h2 className="font-display text-3xl">Almost there.</h2>
                <p className="text-muted-foreground mt-2 text-sm">When should we ping you about new green-rated deals?</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Alert frequency</Label>
                <div className="grid grid-cols-3 gap-2">
                  {["Real-time", "Daily digest", "Weekly digest"].map((f) => (
                    <button key={f} className="px-3 py-3 rounded-lg border border-border first:border-primary first:bg-primary/10 first:text-primary text-sm">
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="ds-card p-4 bg-primary/5 border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/15 grid place-items-center text-primary shrink-0">
                    <Check className="h-4 w-4" />
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">You're set up</div>
                    <div className="text-muted-foreground mt-1 text-xs">{role} · {regions.length} regions · {assets.length} asset types · min yield {minYield.toFixed(1)}% · {riskAppetite.toLowerCase()} risk.</div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => navigate("/dashboard")} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
                Open dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
