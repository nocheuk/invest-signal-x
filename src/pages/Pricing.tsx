import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Mail } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

const PLANS = [
  {
    name: "Beta",
    price: "£19",
    suffix: "/month",
    tag: "For early users validating their acquisition workflow.",
    cta: "Request beta access",
    features: [
      "Commercial deal dashboard",
      "Daily England scan results",
      "Rightmove Commercial + Acuitus imports",
      "DealSignal score and confidence",
      "Saved alerts",
      "Pipeline tracking",
      "PDF investment packs",
    ],
  },
  {
    name: "Pro",
    price: "£49",
    suffix: "/month",
    tag: "For active investors who want more saved criteria and monitoring.",
    popular: true,
    cta: "Request beta access",
    features: [
      "Everything in Beta",
      "More saved alerts",
      "More tracked pipeline deals",
      "Priority beta support",
      "Expanded source coverage as it ships",
      "Exportable investment packs",
      "Early access to scoring improvements",
    ],
  },
  {
    name: "Insider",
    price: "Contact us",
    suffix: "",
    tag: "For acquisition teams with specific locations, asset types or workflows.",
    cta: "Contact us",
    features: [
      "Custom onboarding",
      "Priority source requests",
      "Team workflow scoping",
      "Custom import support",
      "Feedback calls during beta",
      "Roadmap input",
    ],
  },
];

export default function Pricing() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    investorType: "",
    targetLocations: "",
    budgetRange: "",
  });

  const mailto = useMemo(() => {
    const subject = encodeURIComponent("DealSignal beta access request");
    const body = encodeURIComponent([
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Investor type: ${form.investorType}`,
      `Target locations: ${form.targetLocations}`,
      `Budget range: ${form.budgetRange}`,
    ].join("\n"));
    return `mailto:hello@dealsignal.co.uk?subject=${subject}&body=${body}`;
  }, [form]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4 text-sm">
            <ThemeToggle compact />
            <Link to="/" className="text-muted-foreground hover:text-foreground">Home</Link>
            <Link to="/auth" className="text-muted-foreground hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-12 space-y-16">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="text-xs uppercase tracking-widest text-primary font-medium">Early Beta Pricing</div>
          <h1 className="font-display text-5xl">Start tracking commercial acquisition opportunities for less than one agent lunch.</h1>
          <p className="text-muted-foreground">
            DealSignal is in early paid beta. Request access and we will confirm the right plan before onboarding.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 items-stretch">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "ds-card-elevated p-6 lg:p-8 space-y-6 relative flex flex-col",
                plan.popular && "border-primary/40 ring-1 ring-primary/30 ds-glow"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] uppercase tracking-widest font-semibold px-3 py-1 rounded-full">
                  Best for active users
                </div>
              )}
              <div>
                <div className="font-display text-3xl">{plan.name}</div>
                <div className="text-xs text-muted-foreground mt-2 leading-relaxed">{plan.tag}</div>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-5xl">{plan.price}</span>
                  {plan.suffix && <span className="text-sm text-muted-foreground">{plan.suffix}</span>}
                </div>
              </div>
              <Button asChild className={cn("w-full", plan.popular ? "bg-primary text-primary-foreground hover:bg-primary/90" : "")} variant={plan.popular ? "default" : "outline"}>
                <a href="#request-access">{plan.cta}</a>
              </Button>
              <ul className="space-y-2.5 pt-4 border-t border-border/60 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <section id="request-access" className="grid lg:grid-cols-2 gap-6 items-start">
          <div className="ds-card p-6 lg:p-8">
            <div className="text-xs uppercase tracking-widest text-primary font-medium">Request Access</div>
            <h2 className="font-display text-3xl mt-2">Tell us what you are looking for.</h2>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              This opens your email client with the details below. We are keeping the beta flow simple until payments are enabled.
            </p>
            <div className="mt-6 space-y-3">
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Name" aria-label="Name" />
              <Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email" type="email" aria-label="Email" />
              <Select value={form.investorType} onValueChange={(value) => setForm({ ...form, investorType: value })}>
                <SelectTrigger aria-label="Investor type"><SelectValue placeholder="Investor type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Private investor">Private investor</SelectItem>
                  <SelectItem value="Developer">Developer</SelectItem>
                  <SelectItem value="Deal sourcer">Deal sourcer</SelectItem>
                  <SelectItem value="Acquisition team">Acquisition team</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Textarea value={form.targetLocations} onChange={(event) => setForm({ ...form, targetLocations: event.target.value })} placeholder="Target locations, e.g. Dorset, Hampshire, Manchester" aria-label="Target locations" />
              <Input value={form.budgetRange} onChange={(event) => setForm({ ...form, budgetRange: event.target.value })} placeholder="Budget range, e.g. £250k-£2m" aria-label="Budget range" />
              <Button asChild className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                <a href={mailto}><Mail className="h-4 w-4" /> Request beta access</a>
              </Button>
            </div>
          </div>

          <div className="ds-card p-6 lg:p-8 space-y-4">
            <div className="text-xs uppercase tracking-widest text-primary font-medium">Disclaimer</div>
            <h2 className="font-display text-3xl">Use DealSignal as a first-pass filter.</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              DealSignal is not financial advice and is not a valuation. Data may be incomplete or wrong. Users must verify source listings, price, lease, tenancy, title, planning, condition and comparable evidence before making offers.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Scoring and confidence labels are decision-support tools intended to help prioritise further diligence, not replace professional advice.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
