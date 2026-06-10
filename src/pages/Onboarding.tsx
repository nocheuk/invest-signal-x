import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgePoundSterling,
  Bell,
  BriefcaseBusiness,
  Building2,
  Check,
  ClipboardCheck,
  Flag,
  Gauge,
  Landmark,
  Loader2,
  MapPin,
  ShieldAlert,
  Sparkles,
  Target,
  WalletCards,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useStrategy } from "@/lib/strategy";
import { useSavedAlerts } from "@/hooks/useSavedAlerts";
import { useProfile } from "@/hooks/useProfile";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase/client";
import { isAdminUser } from "@/lib/admin";
import {
  ALERT_PREFERENCES,
  DEAL_BLOCKERS,
  DEAL_PREFERENCES,
  DEFAULT_ONBOARDING,
  EXPERIENCE_LEVELS,
  FINANCING_POSITIONS,
  INVESTMENT_STRATEGIES,
  INVESTOR_TYPES,
  PREFERRED_ASSET_TYPES,
  RISK_APPETITES,
  acquisitionBriefSummary,
  alertFromOnboarding,
  alertPreferencesFromOnboarding,
  buildProfilePreferences,
  getInvestorPreferences,
  parseLocations,
  strategyFromOnboarding,
  type InvestorOnboardingAnswers,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, title: "Profile", helper: "Who is buying?", icon: Building2 },
  { n: 2, title: "Objective", helper: "What should win?", icon: Target },
  { n: 3, title: "Locations", helper: "Where to scan first?", icon: MapPin },
  { n: 4, title: "Capital", helper: "Budget and finance", icon: WalletCards },
  { n: 5, title: "Assets", helper: "What fits the brief?", icon: BriefcaseBusiness },
  { n: 6, title: "Returns", helper: "Yield and risk", icon: Gauge },
  { n: 7, title: "Blockers", helper: "What to avoid?", icon: ShieldAlert },
  { n: 8, title: "Alerts", helper: "How to notify you", icon: Bell },
  { n: 9, title: "Summary", helper: "Confirm the brief", icon: ClipboardCheck },
] as const;

const LOCAL_KEY = "dealsignal:onboarding";

export default function Onboarding() {
  const auth = useAuth();
  const profile = useProfile();
  const strategy = useStrategy();
  const savedAlerts = useSavedAlerts();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const editMode = new URLSearchParams(location.search).get("edit") === "1";
  const from = (location.state as { from?: string } | null)?.from || (editMode ? "/settings" : "/dashboard");
  const existing = useMemo(() => getInvestorPreferences(profile.data), [profile.data]);
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<InvestorOnboardingAnswers>(DEFAULT_ONBOARDING);
  const [locationsText, setLocationsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const canShowDebug = import.meta.env.DEV || isAdminUser(auth.user);

  useEffect(() => {
    if (!profile.data || hydrated) return;
    setAnswers({
      investorType: existing.investorType,
      strategy: existing.strategy,
      targetLocations: existing.targetLocations,
      budgetRange: existing.budgetRange,
      minBudget: existing.minBudget,
      maxBudget: existing.maxBudget,
      cashAvailable: existing.cashAvailable,
      financingPosition: existing.financingPosition,
      minYieldTarget: existing.minYieldTarget,
      yieldNotImportant: existing.yieldNotImportant,
      capitalGrowthPriority: existing.capitalGrowthPriority,
      preferredAssetTypes: existing.preferredAssetTypes,
      dealPreferences: existing.dealPreferences,
      dealBlockers: existing.dealBlockers,
      riskAppetite: existing.riskAppetite,
      alertPreference: existing.alertPreference,
      experienceLevel: existing.experienceLevel,
      completedAt: existing.completedAt,
      skippedAt: existing.skippedAt,
    });
    setLocationsText(existing.targetLocations.join(", "));
    setHydrated(true);
  }, [existing, hydrated, profile.data]);

  const finalAnswers = useMemo(() => ({
    ...answers,
    targetLocations: parseLocations(locationsText),
    preferredAssetTypes: answers.preferredAssetTypes.length ? answers.preferredAssetTypes : ["Retail"],
  }), [answers, locationsText]);
  const summary = acquisitionBriefSummary(finalAnswers);
  const progress = Math.round((step / STEPS.length) * 100);
  const activeStep = STEPS[step - 1];

  const update = <K extends keyof InvestorOnboardingAnswers>(key: K, value: InvestorOnboardingAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  const toggleList = (key: "preferredAssetTypes" | "dealPreferences" | "dealBlockers", value: string) => {
    setAnswers((current) => {
      const existingValues = current[key];
      const next = value === "None"
        ? existingValues.includes(value) ? [] : ["None"]
        : existingValues.includes(value)
          ? existingValues.filter((item) => item !== value)
          : [...existingValues.filter((item) => item !== "None"), value];
      return { ...current, [key]: next };
    });
  };

  const save = async (mode: "completed" | "skipped") => {
    setSaving(true);
    setError(null);
    setErrorDetail(null);
    setWarning(null);

    try {
      if (!isSupabaseConfigured) {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(buildProfilePreferences({}, finalAnswers, mode)));
        navigate(from, { replace: true });
        return;
      }
      if (!auth.user) throw new Error("Sign in to save onboarding.");

      const nextPreferences = buildProfilePreferences(profile.data?.preferences, finalAnswers, mode);
      const profilePayload = {
        id: auth.user.id,
        full_name: profile.data?.full_name ?? auth.user.user_metadata?.full_name ?? auth.user.email?.split("@")[0] ?? null,
        preferences: nextPreferences,
        alert_preferences: alertPreferencesFromOnboarding(finalAnswers),
      };
      const { error: updateError } = await upsertProfile(profilePayload);
      if (updateError) throw updateError;
      queryClient.setQueryData(["profile", auth.user.id], (current: typeof profile.data | undefined) => ({
        ...(current ?? {}),
        ...profilePayload,
      }));

      const sideEffectWarnings: string[] = [];
      if (mode === "completed") {
        try {
          await strategy.save(strategyFromOnboarding(finalAnswers));
        } catch (strategyError) {
          console.warn("Onboarding strategy save failed", strategyError);
          sideEffectWarnings.push("Strategy preferences were saved to your profile, but Your Strategy Score could not be updated yet.");
        }
        const suggestedAlert = alertFromOnboarding(finalAnswers);
        if (suggestedAlert) {
          try {
            await savedAlerts.saveAlert(suggestedAlert);
          } catch (alertError) {
            console.warn("Onboarding suggested alert save failed", alertError);
            sideEffectWarnings.push("Your acquisition brief was saved, but the suggested alert could not be created.");
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["profile", auth.user.id] });
      if (sideEffectWarnings.length) sessionStorage.setItem("dealsignal:onboarding-warning", sideEffectWarnings.join(" "));
      navigate(from, { replace: true });
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Could not save your onboarding answers.";
      setError("Could not save your onboarding answers.");
      setErrorDetail(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/85 backdrop-blur-xl">
        <div className="container h-16 flex items-center justify-between">
          <Logo />
          <button type="button" onClick={() => void save("skipped")} disabled={saving} className="text-xs font-medium text-muted-foreground hover:text-foreground">
            Skip for now
          </button>
        </div>
      </header>

      <main className="container max-w-7xl py-8 md:py-12">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Investor onboarding
            </div>
            <h1 className="mt-4 font-display text-4xl md:text-5xl">{editMode ? "Edit your acquisition brief" : "Build your acquisition brief"}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Define what you buy, where you buy, how you finance it, and which risks DealSignal should flag before opportunities reach your pipeline.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-surface-1/80 p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Step {step} of {STEPS.length}</span>
              <span>{progress}% complete</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr_360px]">
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-2">
              {STEPS.map((item) => (
                <button
                  key={item.n}
                  type="button"
                  onClick={() => setStep(item.n)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-3 text-left transition-all",
                    step === item.n
                      ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                      : step > item.n
                        ? "border-border/60 bg-surface-1 text-foreground hover:border-primary/30"
                        : "border-border/40 bg-surface-1/70 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("grid h-9 w-9 place-items-center rounded-lg", step >= item.n ? "bg-primary/15 text-primary" : "bg-surface-2 text-muted-foreground")}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{item.title}</div>
                      <div className="text-[11px] text-muted-foreground">{item.helper}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="ds-card-elevated overflow-hidden">
            <div className="border-b border-border/60 bg-surface-1/70 px-5 py-4 md:px-8">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
                  <activeStep.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-primary">Acquisition Brief</div>
                  <h2 className="font-display text-2xl">{activeStep.title}</h2>
                </div>
              </div>
            </div>

            <div className="space-y-8 p-5 md:p-8">
              {step === 1 && (
                <StepShell title="Who are we tailoring DealSignal for?" desc="Choose the closest profile. This helps us tune explanations and defaults without locking you into one use case.">
                  <ChoiceGrid options={INVESTOR_TYPES} value={answers.investorType} onChange={(value) => update("investorType", value)} />
                  <div className="space-y-2">
                    <Label className="text-xs">Experience level</Label>
                    <ChoiceGrid options={EXPERIENCE_LEVELS} value={answers.experienceLevel} onChange={(value) => update("experienceLevel", value)} columns="sm:grid-cols-2" />
                  </div>
                </StepShell>
              )}

              {step === 2 && (
                <StepShell title="What is the main objective?" desc="DealSignal uses this to weight yield, growth, discount, demand and risk in Your Strategy Score.">
                  <ChoiceGrid options={INVESTMENT_STRATEGIES} value={answers.strategy} onChange={(value) => update("strategy", value)} columns="sm:grid-cols-2" />
                </StepShell>
              )}

              {step === 3 && (
                <StepShell title="Where should we focus first?" desc="Add multiple towns, cities, counties or postcode areas. Dashboard location search will default to the first one.">
                  <Field label="Target locations">
                    <Input value={locationsText} onChange={(event) => setLocationsText(event.target.value)} placeholder="Bournemouth, Dorset, Manchester" className="bg-surface-2" />
                    <p className="text-[11px] text-muted-foreground">Separate locations with commas. Leave blank for national coverage.</p>
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {["Bournemouth", "Dorset", "Manchester"].map((locationOption) => (
                      <button
                        key={locationOption}
                        type="button"
                        onClick={() => setLocationsText((current) => appendLocation(current, locationOption))}
                        className="rounded-xl border border-border/60 bg-surface-2 px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                      >
                        Add {locationOption}
                      </button>
                    ))}
                  </div>
                </StepShell>
              )}

              {step === 4 && (
                <StepShell title="What capital stack should the brief assume?" desc="These ranges help alerts avoid lots that are obviously too small or too large for your current acquisition plan.">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Minimum budget">
                      <MoneyInput value={answers.minBudget} onChange={(value) => update("minBudget", value)} />
                    </Field>
                    <Field label="Maximum budget">
                      <MoneyInput value={answers.maxBudget} onChange={(value) => update("maxBudget", value)} />
                    </Field>
                    <Field label="Cash available / deposit range">
                      <Input value={answers.cashAvailable} onChange={(event) => update("cashAvailable", event.target.value)} placeholder="e.g. GBP 250k deposit, cash buyer up to GBP 1m" className="bg-surface-2" />
                    </Field>
                    <Field label="Financing position">
                      <ChoiceGrid options={FINANCING_POSITIONS} value={answers.financingPosition} onChange={(value) => update("financingPosition", value)} columns="sm:grid-cols-1" compact />
                    </Field>
                  </div>
                </StepShell>
              )}

              {step === 5 && (
                <StepShell title="Which assets and deal types fit?" desc="Select as many as apply. These become source filters, alert defaults and strategy context.">
                  <div className="space-y-2">
                    <Label className="text-xs">Preferred asset types</Label>
                    <MultiChoice options={PREFERRED_ASSET_TYPES} values={answers.preferredAssetTypes} onToggle={(value) => toggleList("preferredAssetTypes", value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Deal preferences</Label>
                    <MultiChoice options={DEAL_PREFERENCES} values={answers.dealPreferences} onToggle={(value) => toggleList("dealPreferences", value)} />
                  </div>
                </StepShell>
              )}

              {step === 6 && (
                <StepShell title="How should returns and risk be balanced?" desc="Yield can be de-emphasised for development or owner-occupier briefs while still tracking missing income data.">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-surface-2 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-xs">Minimum yield target</Label>
                        <span className="text-lg font-semibold">{answers.yieldNotImportant ? "Not priority" : `${answers.minYieldTarget}%`}</span>
                      </div>
                      <input type="range" min={0} max={15} step={0.5} value={answers.minYieldTarget} onChange={(event) => update("minYieldTarget", Number(event.target.value))} className="mt-4 w-full accent-primary" disabled={answers.yieldNotImportant} />
                      <button type="button" onClick={() => update("yieldNotImportant", !answers.yieldNotImportant)} className={cn(
                        "mt-4 w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                        answers.yieldNotImportant ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
                      )}>
                        Yield not important for this brief
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Risk appetite</Label>
                        <ChoiceGrid options={RISK_APPETITES} value={answers.riskAppetite} onChange={(value) => update("riskAppetite", value)} columns="sm:grid-cols-2" compact />
                      </div>
                      <button type="button" onClick={() => update("capitalGrowthPriority", !answers.capitalGrowthPriority)} className={cn(
                        "w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                        answers.capitalGrowthPriority ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 bg-surface-2 text-muted-foreground hover:text-foreground"
                      )}>
                        Capital growth is a priority
                      </button>
                    </div>
                  </div>
                </StepShell>
              )}

              {step === 7 && (
                <StepShell title="What should DealSignal treat as a blocker?" desc="These do not hide deals automatically yet, but they help warning copy and future scoring explain what needs extra verification.">
                  <MultiChoice options={DEAL_BLOCKERS} values={answers.dealBlockers} onToggle={(value) => toggleList("dealBlockers", value)} />
                </StepShell>
              )}

              {step === 8 && (
                <StepShell title="How should alerts start?" desc="A first saved alert can be created from your location, asset, price and score criteria. You can edit it later.">
                  <ChoiceGrid options={ALERT_PREFERENCES} value={answers.alertPreference} onChange={(value) => update("alertPreference", value)} columns="sm:grid-cols-2" />
                </StepShell>
              )}

              {step === 9 && (
                <StepShell title="Your acquisition brief" desc="Review the brief DealSignal will use for dashboard defaults, alerts and Your Strategy Score.">
                  <BriefSummary summary={summary} />
                </StepShell>
              )}

              {warning && <div className="rounded-md border border-signal-amber/40 bg-signal-amber/10 px-3 py-2 text-xs text-muted-foreground">{warning}</div>}
              {error && (
                <div className="rounded-md border border-signal-red/40 bg-signal-red/10 px-3 py-2 text-xs text-signal-red">
                  {error}
                  {canShowDebug && errorDetail && <div className="mt-1 font-mono text-[11px] break-all">Detail: {errorDetail}</div>}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-5">
                <Button variant="ghost" size="sm" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1 || saving} className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  {step < STEPS.length && (
                    <Button variant="outline" size="sm" onClick={() => setStep(step + 1)} disabled={saving}>
                      Skip this step
                    </Button>
                  )}
                  {step < STEPS.length ? (
                    <Button onClick={() => setStep(step + 1)} disabled={saving} className="gap-1.5">
                      Continue <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button onClick={() => void save("completed")} disabled={saving} className="gap-1.5">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Save acquisition brief
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="ds-card-elevated overflow-hidden">
              <div className="border-b border-border/60 bg-primary/10 p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                    <Landmark className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Live brief preview</div>
                    <p className="text-xs text-muted-foreground">Saved to your private profile.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4 p-5">
                <BriefMetric icon={MapPin} label="Locations" value={finalAnswers.targetLocations[0] || "National"} />
                <BriefMetric icon={BadgePoundSterling} label="Budget" value={`${compactMoney(finalAnswers.minBudget)} - ${compactMoney(finalAnswers.maxBudget)}`} />
                <BriefMetric icon={Flag} label="Objective" value={finalAnswers.strategy} />
                <BriefMetric icon={Bell} label="Alerts" value={finalAnswers.alertPreference} />
                <div className="rounded-xl border border-border/60 bg-surface-2 p-4">
                  <h3 className="text-sm font-semibold">Your acquisition brief</h3>
                  <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
                    {summary.slice(0, 5).map((line) => <li key={line}>{line}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function StepShell({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-3xl">{title}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function ChoiceGrid({ options, value, onChange, columns = "sm:grid-cols-2", compact = false }: { options: readonly string[]; value: string; onChange: (value: string) => void; columns?: string; compact?: boolean }) {
  return (
    <div className={cn("grid gap-2", columns)}>
      {options.map((option) => (
        <button key={option} type="button" onClick={() => onChange(option)} className={cn(
          "rounded-xl border text-left transition-all",
          compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm",
          value === option ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-border/60 bg-surface-2/70 text-muted-foreground hover:border-primary/30 hover:text-foreground"
        )}>
          {option}
        </button>
      ))}
    </div>
  );
}

function MultiChoice({ options, values, onToggle }: { options: readonly string[]; values: string[]; onToggle: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button key={option} type="button" onClick={() => onToggle(option)} className={cn(
          "rounded-full border px-3 py-1.5 text-xs transition-colors",
          values.includes(option) ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 bg-surface-2 text-muted-foreground hover:text-foreground"
        )}>
          {option}
        </button>
      ))}
    </div>
  );
}

function MoneyInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">GBP</span>
      <Input type="number" min={0} step={50000} value={value || ""} onChange={(event) => onChange(Number(event.target.value))} className="bg-surface-2 pl-12" />
    </div>
  );
}

function BriefSummary({ summary }: { summary: string[] }) {
  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/10 p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Check className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Your acquisition brief</h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            {summary.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

function BriefMetric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2 p-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function appendLocation(current: string, next: string) {
  const values = parseLocations(current);
  if (values.some((value) => value.toLowerCase() === next.toLowerCase())) return values.join(", ");
  return [...values, next].join(", ");
}

function compactMoney(value: number) {
  if (!value) return "Not set";
  if (value >= 1000000) return `GBP ${(value / 1000000).toLocaleString("en-GB", { maximumFractionDigits: 1 })}m`;
  return `GBP ${(value / 1000).toLocaleString("en-GB", { maximumFractionDigits: 0 })}k`;
}

async function upsertProfile(payload: {
  id: string;
  full_name: string | null;
  preferences: unknown;
  alert_preferences: unknown;
}) {
  const db = requireSupabase();
  const result = await db.from("profiles").upsert(payload, { onConflict: "id" });
  if (!isMissingAlertPreferencesColumn(result.error)) return result;

  console.warn("profiles.alert_preferences is missing; saving onboarding preferences without alert preferences until the migration is applied.");
  const { alert_preferences: _alertPreferences, ...fallbackPayload } = payload;
  return db.from("profiles").upsert(fallbackPayload, { onConflict: "id" });
}

function isMissingAlertPreferencesColumn(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "PGRST204" || /alert_preferences/i.test(error.message ?? "");
}
