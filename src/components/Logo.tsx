import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  // 3x3 grid; top-right cell is the signal accent
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* row 1 */}
      <rect x="1" y="1" width="9" height="9" rx="2" className="fill-foreground" />
      <rect x="11.5" y="1" width="9" height="9" rx="2" className="fill-foreground" />
      <rect x="22" y="0" width="10" height="10" rx="2.2" className="fill-primary" />
      {/* row 2 */}
      <rect x="1" y="11.5" width="9" height="9" rx="2" className="fill-foreground" />
      <rect x="11.5" y="11.5" width="9" height="9" rx="2" className="fill-foreground" />
      <rect x="22" y="11.5" width="9" height="9" rx="2" className="fill-foreground" />
      {/* row 3 */}
      <rect x="1" y="22" width="9" height="9" rx="2" className="fill-foreground" />
      <rect x="11.5" y="22" width="9" height="9" rx="2" className="fill-foreground" />
      <rect x="22" y="22" width="9" height="9" rx="2" className="fill-foreground" />
    </svg>
  );
}

export function Logo({
  className,
  withText = true,
  size = "md",
}: {
  className?: string;
  withText?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "sm" ? "h-6 w-6" : size === "lg" ? "h-9 w-9" : "h-7 w-7";
  const text = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";
  return (
    <Link to="/" className={cn("flex items-center gap-2.5 group", className)}>
      <LogoMark className={dim} />
      {withText && (
        <span className={cn("font-semibold tracking-tight", text)}>
          Deal<span className="text-primary">Signal</span>
        </span>
      )}
    </Link>
  );
}
