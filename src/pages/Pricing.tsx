import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Scout",
    monthly: 29,
    annual: 23,
    tag: "For solo investors getting started",
    features: [
      "Daily UK-wide deal scan",
      "Basic email & in-app alerts",
      "Yield calculations",
      "Traffic-light scoring (R/A/G)",
      "Up to 25 watchlisted deals",
      "Standard support",
    ],
  },
  {
    name: "Investor",
    monthly: 99,
    annual: 79,
    tag: "For active acquirers and small funds",
    popular: true,
    features: [
      "Everything in Scout",
      "Full DealSignal Score breakdown",
      "AI underwriting summaries",
      "Comparable transaction checks",
      "Unlimited saved searches",
      "Priority real-time alerts",
      "PDF deal memos",
      "Up to 250 watchlisted deals",
    ],
  },
  {
    name: "Pro",
    monthly: 299,
    annual: 239,
    tag: "For deal sourcing teams and funds",
    features: [
      "Everything in Investor",
      "Up to 5 team seats",
      "Advanced scoring weighting",
      "Portfolio-level watchlists",
      "Off-market deal feed",
      "Sourcing workflow + assignments",
      "API access (read)",
      "Dedicated success manager",
    ],
  },
];

export default function Pricing() {
  const [annual, setAnnual] = useState(true);
  return (
    <AppLayout>
      <div className="container max-w-6xl py-12 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <div className="text-xs uppercase tracking-widest text-primary font-medium">Pricing</div>
          <h1 className="font-display text-5xl">Plans that scale with your pipeline.</h1>
          <p className="text-muted-foreground">No setup fees, cancel anytime. All plans include the full UK commercial scan.</p>
          <div className="inline-flex items-center gap-3 bg-surface-2 rounded-full p-1.5 border border-border/60">
            <button onClick={() => setAnnual(false)} className={cn("px-4 py-1.5 rounded-full text-sm transition-colors", !annual && "bg-surface-3 text-foreground", annual && "text-muted-foreground")}>Monthly</button>
            <button onClick={() => setAnnual(true)} className={cn("px-4 py-1.5 rounded-full text-sm transition-colors flex items-center gap-2", annual && "bg-surface-3 text-foreground", !annual && "text-muted-foreground")}>
              Annual <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium">Save 20%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {PLANS.map((p) => (
            <div key={p.name} className={cn(
              "ds-card-elevated p-6 lg:p-8 space-y-6 relative",
              p.popular && "border-primary/40 ring-1 ring-primary/30 ds-glow"
            )}>
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] uppercase tracking-widest font-semibold px-3 py-1 rounded-full">
                  Most popular
                </div>
              )}
              <div>
                <div className="font-display text-3xl">{p.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{p.tag}</div>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-5xl">£{annual ? p.annual : p.monthly}</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                {annual && <div className="text-xs text-muted-foreground mt-1">Billed annually · £{p.annual * 12}/yr</div>}
              </div>
              <Button className={cn("w-full", p.popular ? "bg-primary text-primary-foreground hover:bg-primary/90" : "")} variant={p.popular ? "default" : "outline"}>
                {p.popular ? "Start free 14-day trial" : "Choose " + p.name}
              </Button>
              <ul className="space-y-2.5 pt-4 border-t border-border/60">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="ds-card p-6 lg:p-8 text-center">
          <h3 className="font-display text-2xl">Need a fund-grade plan?</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">For funds running £50m+ pipelines, we offer custom seat counts, bespoke scoring weights, and white-glove onboarding.</p>
          <Button variant="outline" className="mt-5">Talk to us</Button>
        </div>
      </div>
    </AppLayout>
  );
}
