import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocationImportError, useLocationImport } from "@/hooks/useLocationImport";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    session: { access_token: "user-token" },
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useLocationImport", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps API error responses with detail for dev/admin display", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({
        error: "Live search is currently unavailable. Run manual import or try again later.",
        detail: "Rightmove page could not be parsed. The custom scraper may need updating.",
        code: "scraper_unavailable",
        diagnostics: {
          generatedUrl: "https://www.rightmove.co.uk/commercial-property-for-sale/Southampton.html",
          env: { VITE_SUPABASE_URL: true, VITE_SUPABASE_ANON_KEY: true, SUPABASE_SERVICE_ROLE_KEY: false },
          vercelGitCommitSha: "abc123",
        },
      }),
    })));

    const { result } = renderHook(() => useLocationImport(), { wrapper });
    result.current.mutate({ locationQuery: "Southampton" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(LocationImportError);
    expect(result.current.error?.message).toBe("Live search is currently unavailable. Run manual import or try again later.");
    expect((result.current.error as LocationImportError).detail).toContain("Rightmove page could not be parsed");
    expect((result.current.error as LocationImportError).diagnostics?.env?.SUPABASE_SERVICE_ROLE_KEY).toBe(false);
  });
});
