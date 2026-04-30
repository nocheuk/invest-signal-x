import { Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Logo({ className, withText = true, size = "md" }: { className?: string; withText?: boolean; size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const text = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";
  return (
    <Link to="/" className={cn("flex items-center gap-2.5 group", className)}>
      <div className={cn(
        "relative grid place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-glow ds-glow",
        dim
      )}>
        <Activity className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
      </div>
      {withText && (
        <span className={cn("font-semibold tracking-tight", text)}>
          Deal<span className="text-primary">Signal</span>
        </span>
      )}
    </Link>
  );
}
