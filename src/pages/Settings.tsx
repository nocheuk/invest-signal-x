import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ASSET_TYPES, REGIONS } from "@/lib/deals";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Settings() {
  const [regions, setRegions] = useState<string[]>(["South East", "North West", "Yorkshire"]);
  const [assets, setAssets] = useState<string[]>(["Industrial", "Convenience", "Healthcare"]);
  const [risk, setRisk] = useState("Balanced");
  const [freq, setFreq] = useState("Daily digest");
  const [minYield, setMinYield] = useState(6);

  const toggle = (arr: string[], setter: (v: string[]) => void, val: string) =>
    setter(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  const save = () => toast.success("Settings saved", { description: "Your preferences will apply to the next deal scan." });

  return (
    <AppLayout>
      <div className="container max-w-4xl py-8 space-y-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-primary font-medium">Settings</div>
          <h1 className="font-display text-4xl mt-1">Workspace preferences</h1>
          <p className="text-muted-foreground text-sm mt-1">Tune your deal flow, alerts, and underwriting profile.</p>
        </div>

        <Section title="Profile" desc="Your name and identity inside the workspace.">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full name"><Input defaultValue="Jane Sterling" className="bg-surface-2 border-border/60" /></Field>
            <Field label="Work email"><Input defaultValue="jane@northbank.co.uk" className="bg-surface-2 border-border/60" /></Field>
            <Field label="Firm"><Input defaultValue="Northbank Capital" className="bg-surface-2 border-border/60" /></Field>
            <Field label="Role">
              <div className="grid grid-cols-4 gap-1.5">
                {["Investor", "Developer", "Sourcer", "Agent"].map(r => (
                  <button key={r} className={cn("px-2 py-2 rounded-md border text-xs", r === "Investor" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>{r}</button>
                ))}
              </div>
            </Field>
          </div>
        </Section>

        <Section title="Deal preferences" desc="What kind of deals should we surface?">
          <div className="space-y-5">
            <div>
              <Label className="text-xs">Preferred regions</Label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {REGIONS.slice(1).map(r => (
                  <button key={r} onClick={() => toggle(regions, setRegions, r)} className={cn("px-3 py-1.5 rounded-full border text-xs", regions.includes(r) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>{r}</button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Asset types</Label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {ASSET_TYPES.map(a => (
                  <button key={a} onClick={() => toggle(assets, setAssets, a)} className={cn("px-3 py-1.5 rounded-full border text-xs", assets.includes(a) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>{a}</button>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <Label className="text-xs">Minimum target yield: <span className="font-mono text-primary">{minYield.toFixed(1)}%</span></Label>
                <input type="range" min={4} max={12} step={0.5} value={minYield} onChange={(e) => setMinYield(+e.target.value)} className="w-full mt-2 accent-primary" />
              </div>
              <div>
                <Label className="text-xs">Risk appetite</Label>
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  {["Conservative", "Balanced", "Opportunistic"].map(r => (
                    <button key={r} onClick={() => setRisk(r)} className={cn("px-2 py-2 rounded-md border text-xs", risk === r ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>{r}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Alerts" desc="How and when we contact you.">
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Alert frequency</Label>
              <div className="grid sm:grid-cols-3 gap-2 mt-2">
                {["Real-time", "Daily digest", "Weekly digest"].map(f => (
                  <button key={f} onClick={() => setFreq(f)} className={cn("px-3 py-2.5 rounded-lg border text-sm", freq === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>{f}</button>
                ))}
              </div>
            </div>
            <Toggle label="Only alert on green-rated deals" desc="Skip amber and red ratings in alerts." defaultChecked />
            <Toggle label="Auction lot alerts" desc="Get notified about auction listings 48 hours before close." defaultChecked />
            <Toggle label="Off-market deals (Pro)" desc="Surface vetted off-market opportunities first." />
          </div>
        </Section>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline">Cancel</Button>
          <Button onClick={save} className="bg-primary text-primary-foreground hover:bg-primary/90">Save changes</Button>
        </div>
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
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function Toggle({ label, desc, defaultChecked }: { label: string; desc: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-t border-border/40 first:border-0 first:pt-0">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
