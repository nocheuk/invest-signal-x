import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";
import { isOnboardingComplete } from "@/lib/onboarding";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  const profile = useProfile();

  if (!auth.isConfigured) return <>{children}</>;

  if (auth.loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-sm text-muted-foreground">
        Loading DealSignal...
      </div>
    );
  }

  if (!auth.user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (location.pathname !== "/onboarding") {
    if (profile.isLoading) {
      return (
        <div className="min-h-screen grid place-items-center bg-background text-sm text-muted-foreground">
          Loading your acquisition brief...
        </div>
      );
    }

    if (!profile.isError && !isOnboardingComplete(profile.data)) {
      return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
    }
  }

  return <>{children}</>;
}
