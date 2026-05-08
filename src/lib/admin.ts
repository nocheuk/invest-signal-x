import type { User } from "@supabase/supabase-js";

export function isAdminUser(user: User | null) {
  const role = user?.app_metadata?.role || user?.app_metadata?.user_role;
  return role === "admin" || role === "owner";
}
