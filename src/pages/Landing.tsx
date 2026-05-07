import { Link } from "react-router-dom";
import { ArrowRight, Activity, Sparkles, ShieldCheck, Zap, ChartLine, Building2, Search, Bell, Layers, CheckCircle2, MapPin } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DEALS, formatGBP, formatPct } from "@/lib/deals";
import { ScorePill, RatingBadge } from "@/components/RatingBadge";

export default function Landing() {
  const featured = [DEALS[1], DEALS[0], DEALS[5]]; // Wakefield, Tesco, Reading office

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/40">
        <div className="container flex items-center justify-between h-16">
          <Logo />
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#score" className="hover:text-foreground transition-colors">DealSignal Score</a>
            <a href="#example" className="hover:text-foreground transition-colors">Example</a>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline">Sign in</Link>
            <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Link to="/auth">Join early access</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 ds-grid-bg pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(152_70%_48%/0.15),transparent_60%)] pointer-events-none" />
        <div className="container relative pt-20 pb-16 lg:pt-32 lg:pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/60 bg-surface-2/60 text-xs text-muted-foreground mb-8 animate-fade-in">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-green animate-pulse" />
            Now scanning <span className="font-mono tabular text-foreground">14,832</span> live UK commercial listings
          </div>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight max-w-5xl mx-auto animate-fade-in-up">
            Find the commercial property deals <span className="text-gradient-primary italic">everyone else misses.</span>
          </h1>
          <p className="mt-7 max-w-2xl mx-auto text-lg text-muted-foreground leading-relaxed">
            DealSignal scans listings, auctions and investment opportunities, then scores each deal using institutional-grade underwriting signals.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 ds-glow gap-2 h-12 px-6">
              <Link to="/dashboard">View demo dashboard <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-border/60 bg-surface/40 h-12 px-6">
              <Link to="/auth">Join early access</Link>
            </Button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Built for investors, developers and deal sourcers who want faster first-pass underwriting.
          </p>
        </div>

        {/* Hero preview */}
        <div className="container relative pb-20">
          <div className="ds-card-elevated overflow-hidden border-border/60 ds-glow">
            <div className="border-b border-border/60 bg-surface-2 px-4 py-2.5 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-signal-red/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-signal-amber/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-signal-green/70" />
              <span className="ml-3 text-xs text-muted-foreground font-mono">app.dealsignal.io / dashboard</span>
            </div>
            <div className="p-4 sm:p-6 grid lg:grid-cols-3 gap-4">
              {featured.map((d) => (
                <div key={d.id} className="ds-card p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{d.assetType}</div>
                      <div className="font-semibold text-sm mt-0.5">{d.title}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1"><MapPin className="h-3 w-3" />{d.location}</div>
                    </div>
                    <ScorePill score={d.score} rating={d.rating} size="sm" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
                    <div><div className="text-[9px] text-muted-foreground uppercase">Guide</div><div className="font-mono text-xs font-semibold">{formatGBP(d.guidePrice)}</div></div>
                    <div><div className="text-[9px] text-muted-foreground uppercase">NIY</div><div className="font-mono text-xs font-semibold">{d.netInitialYield ? formatPct(d.netInitialYield, 2) : "—"}</div></div>
                    <div><div className="text-[9px] text-muted-foreground uppercase">WAULT</div><div className="font-mono text-xs font-semibold">{d.wault ? `${d.wault.toFixed(1)}y` : "—"}</div></div>
                  </div>
                  <RatingBadge rating={d.rating} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-border/40 bg-surface/40">
        <div className="container py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { k: "14.8k", l: "Listings scanned daily" },
            { k: "27", l: "Underwriting signals" },
            { k: "2.4s", l: "Average deal scoring time" },
            { k: "£3.2bn", l: "GDV analysed in beta" },
          ].map((s) => (
            <div key={s.l}>
              <div className="font-display text-3xl md:text-4xl text-gradient-soft">{s.k}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="container py-20 lg:py-28">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-widest text-primary font-medium mb-3">How it works</div>
          <h2 className="font-display text-4xl md:text-5xl tracking-tight">Three steps to your shortlist.</h2>
          <p className="mt-4 text-muted-foreground">From raw listing to underwriting-grade summary in under a minute.</p>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {[
            { i: Search, t: "Scan", d: "We watch agents, auction houses and off-market feeds across the UK in near real-time." },
            { i: Activity, t: "Score", d: "Every deal is run through 27 institutional-grade signals — yield, covenant, lease, reversion and risk." },
            { i: Bell, t: "Alert", d: "You get a clean, ranked shortlist with green/amber/red ratings and one-page underwriting." },
          ].map((s, i) => (
            <div key={s.t} className="ds-card p-6 relative overflow-hidden">
              <div className="absolute top-3 right-4 font-mono text-[11px] text-muted-foreground/60">0{i + 1}</div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary mb-4">
                <s.i className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg">{s.t}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DealSignal Score */}
      <section id="score" className="border-y border-border/40 bg-gradient-to-b from-surface/30 to-transparent">
        <div className="container py-20 lg:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-medium mb-3">DealSignal Score</div>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight">One number. Five disciplines.</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              The DealSignal Score combines five weighted underwriting categories into a single 0–100 number — the way an institutional acquisitions desk would frame it.
            </p>
            <div className="mt-8 space-y-3">
              {[
                { l: "Yield & income quality", w: 25 },
                { l: "Tenant & lease security", w: 25 },
                { l: "Market pricing & comparables", w: 20 },
                { l: "Upside, planning & reversion", w: 15 },
                { l: "Risk & exit liquidity", w: 15 },
              ].map((c) => (
                <div key={c.l} className="flex items-center gap-4">
                  <div className="font-mono text-sm tabular w-12 text-muted-foreground">{c.w}%</div>
                  <div className="flex-1">
                    <div className="text-sm">{c.l}</div>
                    <div className="mt-1.5 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${c.w * 4}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="ds-card-elevated p-8 lg:p-10 text-center relative overflow-hidden">
            <div className="absolute inset-0 ds-grid-bg opacity-30" />
            <div className="relative">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Example</div>
              <div className="font-display text-9xl text-gradient-primary mt-4">87</div>
              <RatingBadge rating="green" className="mt-3 mx-auto" />
              <div className="mt-6 font-medium">Multi-let Industrial Estate · Wakefield</div>
              <div className="text-xs text-muted-foreground mt-1">Strong reversion, mid-tier covenant mix, 4.6yr WAULT</div>
              <div className="mt-6 grid grid-cols-3 gap-3 text-left">
                <div className="bg-surface-2 rounded-lg p-3"><div className="text-[10px] text-muted-foreground uppercase">NIY</div><div className="font-mono font-semibold">7.45%</div></div>
                <div className="bg-surface-2 rounded-lg p-3"><div className="text-[10px] text-muted-foreground uppercase">Reversion</div><div className="font-mono font-semibold">9.10%</div></div>
                <div className="bg-surface-2 rounded-lg p-3"><div className="text-[10px] text-muted-foreground uppercase">£/sqft</div><div className="font-mono font-semibold">£81</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Example analysis */}
      <section id="example" className="container py-20 lg:py-28">
        <div className="max-w-2xl mb-10">
          <div className="text-xs uppercase tracking-widest text-primary font-medium mb-3">Example analysis</div>
          <h2 className="font-display text-4xl md:text-5xl tracking-tight">Investor-grade insight, in plain English.</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          {[
            { t: "Why this may be mispriced", d: "Yield 25–40 bps wide of comparable Tesco lots in similar catchments — pricing reflects nervousness around CPI cap, but cap is at 4%.", icon: Sparkles },
            { t: "What could go wrong", d: "If CPI normalises below 2% for the next 5 years, rental growth lags retail comps and reversion compresses.", icon: ShieldCheck },
            { t: "What to ask the agent", d: "Confirm CPI floor and cap, schedule of condition, and any tenant break options not in the headline.", icon: Search },
            { t: "Negotiation angle", d: "Push for £1.85m citing 6.4% NIY benchmark and 12 months until next CPI review.", icon: ChartLine },
          ].map((c) => (
            <div key={c.t} className="ds-card p-6">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 grid place-items-center text-primary shrink-0">
                  <c.icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold">{c.t}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{c.d}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-y border-border/40 bg-surface/30">
        <div className="container py-20 lg:py-28">
          <div className="max-w-2xl mb-10">
            <div className="text-xs uppercase tracking-widest text-primary font-medium mb-3">Who it's for</div>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight">Built for serious operators.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { t: "Investors", d: "Skip 90% of the listings noise. Spend your time underwriting the 10% that actually merit it.", i: Building2 },
              { t: "Developers", d: "Surface mispriced sites and reversionary plays before the rest of the market catches up.", i: Layers },
              { t: "Deal sourcers", d: "Build a defensible pipeline of quality deals, with one-page memos your clients can read in 90 seconds.", i: Zap },
            ].map((c) => (
              <div key={c.t} className="ds-card p-6 hover:border-primary/30 transition-colors">
                <c.i className="h-6 w-6 text-primary mb-4" />
                <h3 className="font-semibold text-lg">{c.t}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="container py-20 lg:py-28">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-xs uppercase tracking-widest text-primary font-medium mb-3">Pricing</div>
          <h2 className="font-display text-4xl md:text-5xl tracking-tight">Private deal intelligence, priced for serious investors.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {[
            { name: "Scout", price: "£49", d: "Smarter first-pass filtering with the DealSignal Score and traffic-light ratings.", popular: false },
            { name: "Investor", price: "£149", d: "Strategy Optimiser, personalised Your Score, advanced filters and priority alerts.", popular: true },
            { name: "Insider Access", price: "From £500", d: "Curated weekly shortlist, bespoke sourcing briefs and direct introductions.", popular: false },
          ].map((p) => (
            <div key={p.name} className={`ds-card-elevated p-6 ${p.popular ? "border-primary/40 ring-1 ring-primary/30 ds-glow" : ""}`}>
              {p.popular && <div className="text-[10px] uppercase tracking-widest text-primary font-medium mb-2">Most popular</div>}
              <div className="font-display text-2xl">{p.name}</div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-5xl">{p.price}</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mt-3">{p.d}</p>
              <Button asChild className="w-full mt-6" variant={p.popular ? "default" : "outline"}>
                <Link to="/pricing">See details</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border/40 bg-surface/30">
        <div className="container py-20 lg:py-28 grid lg:grid-cols-2 gap-12">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-medium mb-3">FAQ</div>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight">Sensible questions, clear answers.</h2>
            <p className="mt-4 text-muted-foreground">DealSignal is a first-pass underwriting tool — never a substitute for full DD, agent calls, and your own legal advice.</p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {[
              { q: "Where does the data come from?", a: "We aggregate listings from major UK commercial agents, the principal auction houses (Allsop, Acuitus, Savills, BidX1) and a growing set of off-market feeds. We never resell raw vendor data." },
              { q: "How accurate is the DealSignal Score?", a: "It is calibrated against historical transaction data and continually back-tested. Treat it as a triage signal, not an investment decision — the score is designed to surface deals worth a second look, and flag ones that aren't." },
              { q: "Do I need to be an institutional investor?", a: "No. Scout starts at £29/month and is designed for solo investors making their first 1–5 acquisitions. Pro is for teams running structured pipelines." },
              { q: "Will it tell me when to bid at auction?", a: "We show you a guide-price risk indicator and our own modelled stabilised yield, but bidding is your call. We try hard to flag yield-trap auction lots before you waste time on them." },
              { q: "How are advanced metrics like reversion and exit yield modelled?", a: "We use sector ERV benchmarks, comparable evidence within 2 miles where available, and a Monte Carlo on cap-rate sensitivity. Methodology is documented in the app for every score." },
            ].map((f) => (
              <AccordionItem key={f.q} value={f.q} className="border-border/40">
                <AccordionTrigger className="text-left hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container py-20 lg:py-28">
        <div className="ds-card-elevated p-10 lg:p-16 text-center relative overflow-hidden ds-glow">
          <div className="absolute inset-0 ds-grid-bg opacity-30" />
          <div className="relative">
            <h2 className="font-display text-4xl md:text-6xl tracking-tight max-w-3xl mx-auto">
              Stop sifting. <span className="text-gradient-primary italic">Start underwriting.</span>
            </h2>
            <p className="mt-6 text-muted-foreground max-w-xl mx-auto">Try the demo dashboard now — no signup required — or join the early access list.</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 ds-glow gap-2 h-12 px-6">
                <Link to="/dashboard">View demo dashboard <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-border/60 h-12 px-6">
                <Link to="/auth">Join early access</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/40">
        <div className="container py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="text-xs">© 2026 DealSignal Ltd. UK commercial property intelligence.</span>
          </div>
          <div className="flex items-center gap-5 text-xs">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Methodology</a>
            <a href="#" className="hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
