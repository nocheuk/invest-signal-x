import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase/client";

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: isSupabaseConfigured && Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
