import { Link } from "react-router-dom";
import { ArrowRight, Bell, Bookmark, FileText, MapPin, Search, ShieldCheck, TrendingUp } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

const CAPABILITIES = [
  {
    icon: Search,
    title: "Daily national scans",
    body: "DealSignal scans priority locations across England and refreshes Rightmove Commercial and Acuitus opportunities into one dashboard.",
  },
  {
    icon: TrendingUp,
    title: "Scoring and confidence",
    body: "Every imported deal gets a DealSignal score, data confidence label, opportunity signals and missing-data warnings.",
  },
  {
    icon: Bell,
    title: "Saved alerts",
    body: "Save your criteria and get matching deal alerts when new imported opportunities fit your strategy.",
  },
  {
    icon: FileText,
    title: "Investment packs",
    body: "Generate structured PDF investment packs from real deal data, including thesis, comparables, financial analysis and what still needs verification.",
  },
  {
    icon: Bookmark,
    title: "Pipeline tracking",
    body: "Move saved deals from Saved to Reviewing, Viewing Booked, Offer Submitted, Passed or Purchased with private notes.",
  },
  {
    icon: ShieldCheck,
    title: "Clear disclaimers",
    body: "Scores are decision-support signals, not valuations. Users must verify property details before making offers.",
  },
];

const SOURCES = ["Rightmove Commercial", "Acuitus", "Manual CSV imports", "Custom HTML scrapers"];

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/40">
        <div className="container flex items-center justify-between h-16">
          <Logo />
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#sources" className="hover:text-foreground transition-colors">Sources</a>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <a href="#disclaimer" className="hover:text-foreground transition-colors">Disclaimer</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline">Sign in</Link>
            <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Link to="/pricing#request-access">Request beta access</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 ds-grid-bg pointer-events-none" />
          <div className="container relative pt-20 pb-16 lg:pt-32 lg:pb-24">
            <div className="mx-auto max-w-4xl text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/60 bg-surface-2/60 text-xs text-muted-foreground mb-8">
                <span className="h-1.5 w-1.5 rounded-full bg-signal-green" />
                Early paid beta for commercial property investors
              </div>
              <h1 className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tight">
                Find commercial property investment opportunities across England automatically.
              </h1>
              <p className="mt-7 max-w-2xl mx-auto text-lg text-muted-foreground leading-relaxed">
                DealSignal combines commercial property deal discovery, daily national scans, scoring, alerts, PDF investment packs and pipeline tracking in one focused workflow.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center">
                <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 ds-glow gap-2 h-12 px-6">
                  <Link to="/pricing#request-access">Request beta access <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-border/60 bg-surface/40 h-12 px-6">
                  <Link to="/auth">Sign in</Link>
                </Button>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                Built for investors, developers and deal sourcers who want faster first-pass review of acquisition opportunities.
              </p>
            </div>
          </div>
        </section>

        <section id="how" className="border-y border-border/40 bg-surface/30">
          <div className="container py-16 lg:py-20">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-widest text-primary font-medium mb-3">What DealSignal Does</div>
              <h2 className="font-display text-4xl tracking-tight">From live source to tracked opportunity.</h2>
              <p className="mt-4 text-muted-foreground">
                The beta focuses on a practical workflow: import real listings, score them honestly, alert users, and help them track what happens next.
              </p>
            </div>
            <div className="mt-10 grid md:grid-cols-3 gap-5">
              {CAPABILITIES.map((item) => (
                <div key={item.title} className="ds-card p-6">
                  <item.icon className="h-5 w-5 text-primary mb-4" />
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="sources" className="container py-16 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <div>
              <div className="text-xs uppercase tracking-widest text-primary font-medium mb-3">Sources</div>
              <h2 className="font-display text-4xl tracking-tight">Rightmove Commercial + Acuitus first.</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                DealSignal currently supports server-side imports from Rightmove Commercial and Acuitus, with manual CSV and custom HTML scraper tooling for additional commercial agent and auction sources.
              </p>
            </div>
            <div className="ds-card p-6 space-y-3">
              {SOURCES.map((source) => (
                <div key={source} className="flex items-center gap-3 border-b border-border/40 last:border-0 pb-3 last:pb-0">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-sm">{source}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="disclaimer" className="border-y border-border/40 bg-surface/30">
          <div className="container py-16 lg:py-20">
            <div className="ds-card p-6 lg:p-8">
              <div className="text-xs uppercase tracking-widest text-primary font-medium mb-3">Important Disclaimer</div>
              <h2 className="font-display text-3xl">Decision support, not financial advice.</h2>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-3xl">
                DealSignal is not financial, investment, tax, legal or valuation advice. Imported data may be incomplete, stale or incorrect. Users must verify property details, tenancy, lease terms, title, condition, planning, comparable evidence and pricing before making offers or investment decisions.
              </p>
            </div>
          </div>
        </section>

        <section className="container py-16 lg:py-20">
          <div className="ds-card-elevated p-8 lg:p-12 text-center">
            <h2 className="font-display text-4xl tracking-tight">Ready to try the beta?</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Request access and tell us your target locations, budget and investor type. We are onboarding early users in small batches.
            </p>
            <Button asChild size="lg" className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
              <Link to="/pricing#request-access">Request beta access <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40">
        <div className="container py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="text-xs">© 2026 DealSignal. Commercial property decision-support software.</span>
          </div>
          <div className="flex items-center gap-5 text-xs">
            <Link to="/pricing#request-access" className="hover:text-foreground">Contact</Link>
            <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
