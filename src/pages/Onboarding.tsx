import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Bell, Building2, Check, Loader2, MapPin, Target } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useStrategy } from "@/lib/strategy";
import { useSavedAlerts } from "@/hooks/useSavedAlerts";
import { useProfile } from "@/hooks/useProfile";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase/client";
import { isAdminUser } from "@/lib/admin";
import {
  ALERT_PREFERENCES,
  BUDGET_RANGES,
  DEFAULT_ONBOARDING,
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
  { n: 1, title: "Investor", icon: Building2 },
  { n: 2, title: "Strategy", icon: Target },
  { n: 3, title: "Targets", icon: MapPin },
  { n: 4, title: "Alerts", icon: Bell },
];

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
      minYieldTarget: existing.minYieldTarget,
      preferredAssetTypes: existing.preferredAssetTypes,
      riskAppetite: existing.riskAppetite,
      alertPreference: existing.alertPreference,
      completedAt: existing.completedAt,
      skippedAt: existing.skippedAt,
    });
    setLocationsText(existing.targetLocations.join(", "));
    setHydrated(true);
  }, [existing, hydrated, profile.data]);

  const summary = acquisitionBriefSummary({ ...answers, targetLocations: parseLocations(locationsText) });
  const progress = Math.round((step / STEPS.length) * 100);

  const update = <K extends keyof InvestorOnboardingAnswers>(key: K, value: InvestorOnboardingAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  const toggleAsset = (asset: string) => {
    setAnswers((current) => ({
      ...current,
      preferredAssetTypes: current.preferredAssetTypes.includes(asset)
        ? current.preferredAssetTypes.filter((item) => item !== asset)
        : [...current.preferredAssetTypes, asset],
    }));
  };

  const save = async (mode: "completed" | "skipped") => {
    setSaving(true);
    setError(null);
    setErrorDetail(null);
    setWarning(null);
    const finalAnswers = {
      ...answers,
      targetLocations: parseLocations(locationsText),
      preferredAssetTypes: answers.preferredAssetTypes.length ? answers.preferredAssetTypes : ["Retail"],
    };

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
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="container h-16 flex items-center justify-between">
          <Logo />
          <button type="button" onClick={() => void save("skipped")} disabled={saving} className="text-xs text-muted-foreground hover:text-foreground">
            Skip for now
          </button>
        </div>
      </header>

      <main className="flex-1 container max-w-4xl py-8 md:py-12">
        <div className="mb-8 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-medium">Investor Onboarding</div>
            <h1 className="font-display text-4xl mt-1">{editMode ? "Edit your acquisition brief" : "Build your acquisition brief"}</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              A short setup flow so DealSignal can personalise dashboard defaults, alerts, and Your Strategy Score.
            </p>
          </div>
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {STEPS.map((item) => (
              <button key={item.n} type="button" onClick={() => setStep(item.n)} className={cn(
                "rounded-lg border px-2 py-2 text-left transition-colors",
                step >= item.n ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 bg-surface-2 text-muted-foreground"
              )}>
                <div className="flex items-center gap-2">
                  <item.icon className="h-3.5 w-3.5" />
                  <span className="hidden text-xs font-medium sm:inline">{item.title}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <section className="ds-card-elevated p-5 md:p-8 space-y-8">
          {step === 1 && (
            <StepShell title="What kind of investor are you?" desc="This helps tune language, deal emphasis, and future product defaults.">
              <ChoiceGrid options={INVESTOR_TYPES} value={answers.investorType} onChange={(value) => update("investorType", value)} />
            </StepShell>
          )}

          {step === 2 && (
            <StepShell title="What is your acquisition strategy?" desc="We use this to suggest a first strategy weighting profile.">
              <ChoiceGrid options={INVESTMENT_STRATEGIES} value={answers.strategy} onChange={(value) => update("strategy", value)} />
              <div className="space-y-2">
                <Label className="text-xs">Risk appetite</Label>
                <ChoiceGrid options={RISK_APPETITES} value={answers.riskAppetite} onChange={(value) => update("riskAppetite", value)} columns="sm:grid-cols-3" />
              </div>
            </StepShell>
          )}

          {step === 3 && (
            <StepShell title="Where and what should DealSignal prioritise?" desc="These become your default filters and seed your first alert.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Target locations">
                  <Input value={locationsText} onChange={(event) => setLocationsText(event.target.value)} placeholder="Bournemouth, Poole, Dorset" className="bg-surface-2" />
                  <p className="text-[11px] text-muted-foreground">Separate cities, towns, counties, or postcode areas with commas.</p>
                </Field>
                <Field label="Budget range">
                  <Select value={answers.budgetRange} onValueChange={(value) => update("budgetRange", value)}>
                    <SelectTrigger className="bg-surface-2"><SelectValue /></SelectTrigger>
                    <SelectContent>{BUDGET_RANGES.map((range) => <SelectItem key={range} value={range}>{range}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label={`Minimum yield target: ${answers.minYieldTarget}%`}>
                  <input type="range" min={0} max={15} step={0.5} value={answers.minYieldTarget} onChange={(event) => update("minYieldTarget", Number(event.target.value))} className="w-full accent-primary" />
                </Field>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Preferred asset types</Label>
                <div className="flex flex-wrap gap-2">
                  {PREFERRED_ASSET_TYPES.map((asset) => (
                    <button key={asset} type="button" onClick={() => toggleAsset(asset)} className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-colors",
                      answers.preferredAssetTypes.includes(asset) ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
                    )}>
                      {asset}
                    </button>
                  ))}
                </div>
              </div>
            </StepShell>
          )}

          {step === 4 && (
            <StepShell title="How should alerts start?" desc="You can edit or pause alerts later from the Alerts page.">
              <ChoiceGrid options={ALERT_PREFERENCES} value={answers.alertPreference} onChange={(value) => update("alertPreference", value)} columns="sm:grid-cols-4" />
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Your acquisition brief</h3>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {summary.map((line) => <li key={line}>{line}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            </StepShell>
          )}

          {warning && <div className="rounded-md border border-signal-amber/40 bg-signal-amber/10 px-3 py-2 text-xs text-muted-foreground">{warning}</div>}
          {error && (
            <div className="rounded-md border border-signal-red/40 bg-signal-red/10 px-3 py-2 text-xs text-signal-red">
              {error}
              {canShowDebug && errorDetail && <div className="mt-1 font-mono text-[11px] break-all">Detail: {errorDetail}</div>}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border/60 pt-5">
            <Button variant="ghost" size="sm" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1 || saving} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
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
        </section>
      </main>
    </div>
  );
}

function StepShell({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function ChoiceGrid({ options, value, onChange, columns = "sm:grid-cols-2" }: { options: readonly string[]; value: string; onChange: (value: string) => void; columns?: string }) {
  return (
    <div className={cn("grid gap-2", columns)}>
      {options.map((option) => (
        <button key={option} type="button" onClick={() => onChange(option)} className={cn(
          "rounded-lg border px-4 py-3 text-left text-sm transition-all",
          value === option ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-surface-2/70 text-muted-foreground hover:text-foreground"
        )}>
          {option}
        </button>
      ))}
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
