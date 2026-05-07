import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Bookmark, CreditCard, Settings, Search, LogOut, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWatchlist } from "@/lib/watchlist";
import { useAuth } from "@/lib/auth";
import { ReactNode } from "react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/watchlist", label: "Watchlist", icon: Bookmark },
  { to: "/pricing", label: "Pricing", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { ids } = useWatchlist();
  const auth = useAuth();

  const handleSignOut = async () => {
    await auth.signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border/60 bg-sidebar">
        <div className="h-16 flex items-center px-5 border-b border-border/60">
          <Logo />
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || (to === "/dashboard" && pathname.startsWith("/deal/"));
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
                {to === "/watchlist" && ids.length > 0 && (
                  <span className="ml-auto text-[10px] font-mono tabular bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                    {ids.length}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border/60">
          <div className="ds-card p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Investor plan</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">AI summaries, comparables and priority alerts active.</p>
            <Link to="/pricing" className="text-[11px] text-primary hover:underline">Manage plan →</Link>
          </div>
          <button onClick={() => void handleSignOut()} className="mt-3 flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 flex items-center gap-3 px-4 lg:px-8 border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-30">
          <div className="lg:hidden">
            <Logo size="sm" />
          </div>
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search deals, locations, tenants…" className="pl-9 bg-surface-2 border-border/60 h-9" />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-xs gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-signal-green animate-pulse" />
              Live scanning
            </Button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-[11px] font-semibold text-primary-foreground">JS</div>
          </div>
        </header>

        {/* Mobile nav */}
        <nav className="lg:hidden flex overflow-x-auto scrollbar-none gap-1 px-3 py-2 border-b border-border/60 bg-background">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link key={to} to={to} className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap",
                active ? "bg-primary/15 text-primary" : "text-muted-foreground"
              )}>
                <Icon className="h-3.5 w-3.5" />{label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
