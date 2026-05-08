import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase/client";

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: isSupabaseConfigured && Boolean(user?.id),
    queryFn: async () => {
      const db = requireSupabase();
      const { data, error } = await db
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;

      const fullName = typeof user!.user_metadata?.full_name === "string"
        ? user!.user_metadata.full_name
        : user!.email?.split("@")[0] ?? null;
      const { data: created, error: createError } = await db
        .from("profiles")
        .insert({
          id: user!.id,
          full_name: fullName,
          preferences: {},
          alert_preferences: { email: true, frequency: "daily", min_score: 75 },
        })
        .select("*")
        .single();
      if (createError) throw createError;
      return created;
    },
  });
}
