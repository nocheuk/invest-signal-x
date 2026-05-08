import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  if (!auth.isConfigured) return <>{children}</>;
  if (auth.loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-sm text-muted-foreground">
        Loading admin tools...
      </div>
    );
  }

  if (!auth.user) return <Navigate to="/auth" replace />;
  if (!isAdminUser(auth.user)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
