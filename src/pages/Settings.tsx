import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";
import { ThemeToggle } from "@/components/ThemeToggle";
import { acquisitionBriefSummary, getInvestorPreferences } from "@/lib/onboarding";

export default function Settings() {
  const auth = useAuth();
  const profile = useProfile();
  const investorPreferences = getInvestorPreferences(profile.data);
  const brief = acquisitionBriefSummary(investorPreferences);

  return (
    <AppLayout>
      <div className="container max-w-4xl py-8 space-y-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-primary font-medium">Settings</div>
          <h1 className="font-display text-4xl mt-1">Account settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Review the profile attached to your DealSignal account and manage live workflows from the dashboard.
          </p>
        </div>

        <Section title="Profile" desc="Loaded from your authenticated Supabase account.">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full name">
              <Input value={profile.data?.full_name || auth.user?.user_metadata?.full_name || "Not available"} readOnly className="bg-surface-2 border-border/60" />
            </Field>
            <Field label="Work email">
              <Input value={auth.user?.email || "Not available"} readOnly className="bg-surface-2 border-border/60" />
            </Field>
            <Field label="Firm">
              <Input value={profile.data?.company || "Not available"} readOnly className="bg-surface-2 border-border/60" />
            </Field>
            <Field label="Access">
              <Input value={auth.user?.app_metadata?.role ? String(auth.user.app_metadata.role) : "Beta user"} readOnly className="bg-surface-2 border-border/60" />
            </Field>
          </div>
        </Section>

        <Section title="Live workflows" desc="These controls use real saved alerts and pipeline records.">
          <div className="grid sm:grid-cols-2 gap-3">
            <WorkflowLink
              title="Saved alerts"
              desc="Create, edit, pause and delete matching alerts from your target criteria."
              to="/alerts"
            />
            <WorkflowLink
              title="Pipeline"
              desc="Save deals, update review status and keep private notes from deal cards or deal detail."
              to="/pipeline"
            />
          </div>
        </Section>

        <Section title="Your acquisition brief" desc="Used to personalise dashboard defaults, alerts and Your Strategy Score.">
          {investorPreferences.onboardingCompleted ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-surface-2 p-4">
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {brief.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/onboarding?edit=1">Edit acquisition brief</Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-surface-2 p-4">
              <p className="text-sm text-muted-foreground">Complete onboarding to set your acquisition brief.</p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/onboarding">Start onboarding</Link>
              </Button>
            </div>
          )}
        </Section>

        <Section title="Appearance" desc="Dark mode is the default. Your preference is saved on this device.">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-2 p-4">
            <div>
              <div className="text-sm font-semibold">Theme</div>
              <p className="text-xs text-muted-foreground mt-1">Choose dark, light or follow your system setting.</p>
            </div>
            <ThemeToggle />
          </div>
        </Section>

        <Section title="Data and advice disclaimer" desc="Important before relying on deal output.">
          <p className="text-sm text-muted-foreground leading-relaxed">
            DealSignal is not financial advice and is not a valuation. Imported data can be incomplete or stale, and users must verify source listings, tenancy, lease terms, title, planning, condition and comparable evidence before making offers.
          </p>
        </Section>
      </div>
    </AppLayout>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="ds-card p-6 lg:p-8 space-y-5">
      <div>
        <h2 className="font-display text-2xl">{title}</h2>
        <p className="text-xs text-muted-foreground mt-1">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function WorkflowLink({ title, desc, to }: { title: string; desc: string; to: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-2 p-4 space-y-3">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link to={to}>Open</Link>
      </Button>
    </div>
  );
}
