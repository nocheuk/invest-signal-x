import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: false,
  requireSupabase: () => {
    throw new Error("Supabase should not be used in demo mode");
  },
}));

import { useDeals } from "@/hooks/useDeals";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useDeals demo mode", () => {
  it("uses static demo deals when Supabase env vars are missing", async () => {
    const { result } = renderHook(() => useDeals(), { wrapper });

    await waitFor(() => expect(result.current.data?.length).toBeGreaterThan(0));
    expect(result.current.data?.[0].id).toMatch(/^ds-/);
  });
});
