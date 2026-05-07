import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const PLANS = [
  {
    name: "Scout",
    price: "£49",
    suffix: "/month",
    tag: "For early-stage investors who want smarter first-pass filtering.",
    cta: "Start with Scout",
    features: [
      "Access to live deal dashboard",
      "Basic deal filters",
      "DealSignal Score",
      "Limited watchlist",
      "Basic alerts",
      "Green / Amber / Red ratings",
    ],
  },
  {
    name: "Investor",
    price: "£149",
    suffix: "/month",
    tag: "For serious investors who want advanced scoring and personalised deal flow.",
    popular: true,
    cta: "Start free 14-day trial",
    features: [
      "Full deal dashboard",
      "Strategy Optimiser",
      "Personalised \u201cYour Score\u201d",
      "Full deal analysis pages",
      "Advanced filters",
      "Saved strategies",
      "Watchlist and notes",
      "Priority alerts",
      "Weekly top deals report",
    ],
  },
  {
    name: "Insider Access",
    price: "From £500",
    suffix: "/month",
    tag: "For professional investors, developers and acquisition teams who want curated private deal intelligence.",
    cta: "Apply for access",
    features: [
      "Everything in Investor",
      "Curated weekly opportunity shortlist",
      "Priority access to high-conviction deals",
      "Bespoke sourcing briefs",
      "Direct introductions where available",
      "Custom locations and asset-type targeting",
      "Private investor reports",
      "Optional call / review support",
    ],
    footnote:
      "Certain off-market or directly introduced opportunities may include separate success-based acquisition fees.",
  },
];

const FAQS = [
  {
    q: "Do you charge fees on completed acquisitions?",
    a: "Standard platform access is subscription-based. Certain off-market, bespoke, or directly introduced opportunities may include separate success-based acquisition fees, agreed transparently before introduction.",
  },
  {
    q: "Is DealSignal a listing site?",
    a: "No. DealSignal is designed as a deal intelligence platform. It filters, scores and prioritises opportunities to support faster first-pass underwriting.",
  },
  {
    q: "Which plan is best for serious investors?",
    a: "Most serious investors should start with Investor. Insider Access is for investors or developers who want curated deal flow, bespoke sourcing and higher-touch support.",
  },
];

export default function Pricing() {
  return (
    <AppLayout>
      <div className="container max-w-6xl py-12 space-y-16">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <div className="text-xs uppercase tracking-widest text-primary font-medium">Pricing</div>
          <h1 className="font-display text-5xl">Private deal intelligence, priced for serious investors.</h1>
          <p className="text-muted-foreground">
            DealSignal is a curated commercial opportunity intelligence platform — not a listing site.
            Choose the level of insight and acquisition support that matches your strategy.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 items-stretch">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={cn(
                "ds-card-elevated p-6 lg:p-8 space-y-6 relative flex flex-col",
                p.popular && "border-primary/40 ring-1 ring-primary/30 ds-glow"
              )}
            >
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] uppercase tracking-widest font-semibold px-3 py-1 rounded-full">
                  Most popular
                </div>
              )}
              <div>
                <div className="font-display text-3xl">{p.name}</div>
                <div className="text-xs text-muted-foreground mt-2 leading-relaxed">{p.tag}</div>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-5xl">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.suffix}</span>
                </div>
              </div>
              <Button
                className={cn("w-full", p.popular ? "bg-primary text-primary-foreground hover:bg-primary/90" : "")}
                variant={p.popular ? "default" : "outline"}
              >
                {p.cta}
              </Button>
              <ul className="space-y-2.5 pt-4 border-t border-border/60 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              {p.footnote && (
                <p className="text-[11px] text-muted-foreground/80 leading-relaxed border-t border-border/60 pt-4">
                  {p.footnote}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="text-xs uppercase tracking-widest text-primary font-medium">FAQ</div>
            <h2 className="font-display text-3xl">Common questions</h2>
          </div>
          <div className="ds-card p-2 lg:p-4">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-border/60 last:border-0">
                  <AccordionTrigger className="px-4 text-left hover:no-underline">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 text-muted-foreground leading-relaxed">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        <div className="ds-card p-6 lg:p-8 text-center">
          <h3 className="font-display text-2xl">Acquisition teams and funds</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
            For funds and acquisition desks running active pipelines, we offer custom seat counts,
            bespoke scoring weights, and dedicated sourcing support under Insider Access.
          </p>
          <Button variant="outline" className="mt-5">Talk to us</Button>
        </div>
      </div>
    </AppLayout>
  );
}
