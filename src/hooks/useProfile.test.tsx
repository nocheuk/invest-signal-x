import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  insertedProfile: null as unknown,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: {
      id: "real-user-id",
      email: "real@example.com",
      user_metadata: { full_name: "Real User" },
    },
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  requireSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
        single: async () => ({ data: dbMock.insertedProfile, error: null }),
      }),
      insert: (payload: unknown) => {
        dbMock.insertedProfile = { ...(payload as object), company: null, created_at: "", updated_at: "" };
        return {
          select: () => ({
            single: async () => ({ data: dbMock.insertedProfile, error: null }),
          }),
        };
      },
    }),
  }),
}));

import { useProfile } from "@/hooks/useProfile";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

describe("useProfile", () => {
  it("auto-creates missing profiles using auth.users.id", async () => {
    const { result } = renderHook(() => useProfile(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({
      id: "real-user-id",
      full_name: "Real User",
    });
  });
});
