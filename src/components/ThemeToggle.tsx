import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme = "dark", setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = mounted ? theme : "dark";

  return (
    <div
      className={cn("inline-flex items-center rounded-lg border border-border/70 bg-surface-2/70 p-1", compact && "scale-95")}
      aria-label="Theme preference"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = activeTheme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={active}
            aria-label={`Use ${label.toLowerCase()} theme`}
            title={label}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs transition-all",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {!compact && <span className="hidden xl:inline">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
