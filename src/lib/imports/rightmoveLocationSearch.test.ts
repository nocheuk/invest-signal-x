import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildRightmoveCommercialSearchUrl,
  prepareLocationSearchRequest,
  readBearerToken,
  requireAuthenticatedUser,
  slugifyLocation,
  validateLocationQuery,
} from "../../../scripts/lib/rightmoveLocationSearch.mjs";

const authUser = vi.hoisted(() => ({
  user: { id: "admin-1", app_metadata: { role: "admin" } },
  error: null as Error | null,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: authUser.user }, error: authUser.error })),
    },
  }),
}));

describe("Rightmove location search helpers", () => {
  it("generates a Rightmove commercial search URL from a location query", () => {
    expect(slugifyLocation("Bournemouth")).toBe("Bournemouth");
    expect(slugifyLocation("  South  West London  ")).toBe("South-West-London");
    expect(buildRightmoveCommercialSearchUrl("Poole")).toBe("https://www.rightmove.co.uk/commercial-property-for-sale/Poole.html");
    expect(buildRightmoveCommercialSearchUrl("Hampshire")).toBe("https://www.rightmove.co.uk/commercial-property-for-sale/Hampshire.html");
  });

  it("reads bearer tokens without requiring frontend secrets", () => {
    expect(readBearerToken("Bearer abc.def")).toBe("abc.def");
    expect(readBearerToken("")).toBe("");

    const clientHook = fs.readFileSync(path.resolve("src/hooks/useLocationImport.ts"), "utf8");
    expect(clientHook).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(clientHook).not.toContain("runRightmoveCommercialImport");
    expect(clientHook).not.toContain("rightmoveCommercialScraper");
  });

  it("blocks unauthenticated callers and allows any verified Supabase user", async () => {
    await expect(requireAuthenticatedUser({
      authorizationHeader: "",
      env: { VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: "anon" },
    })).resolves.toMatchObject({ ok: false, status: 401 });

    authUser.user = { id: "user-1", app_metadata: { role: "member" } };
    authUser.error = null;

    await expect(requireAuthenticatedUser({
      authorizationHeader: "Bearer token",
      env: { VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: "anon" },
    })).resolves.toMatchObject({ ok: true });
  });

  it("validates a minimum location query length", () => {
    expect(validateLocationQuery("Bo")).toMatchObject({ ok: false });
    expect(validateLocationQuery("Bournemouth")).toMatchObject({ ok: true, normalized: "bournemouth" });
  });

  it("rate limits live searches per user", async () => {
    const supabase = fakeRateLimitSupabase({ hourlyCount: 5, dailyCount: 8 });

    await expect(prepareLocationSearchRequest({
      supabase,
      userId: "user-1",
      locationQuery: "Bournemouth",
      normalizedLocation: "bournemouth",
      now: new Date("2026-05-21T12:00:00Z"),
    })).resolves.toMatchObject({
      ok: false,
      status: 429,
      code: "rate_limited",
    });
  });

  it("reuses a recent same-location search instead of rerunning immediately", async () => {
    const supabase = fakeRateLimitSupabase({
      recent: {
        id: "request-1",
        created_at: "2026-05-21T11:45:00Z",
        result: { imported: 2, existing: 1, failed: 0 },
      },
    });

    await expect(prepareLocationSearchRequest({
      supabase,
      userId: "user-1",
      locationQuery: "Poole",
      normalizedLocation: "poole",
      now: new Date("2026-05-21T12:00:00Z"),
    })).resolves.toMatchObject({
      ok: false,
      status: 200,
      code: "recent_search",
      result: { imported: 2, existing: 1, failed: 0 },
    });
  });
});

function fakeRateLimitSupabase({ recent = null, hourlyCount = 0, dailyCount = 0 } = {}) {
  const counts = [hourlyCount, dailyCount];
  return {
    from: () => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      in() {
        return this;
      },
      gte() {
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return this;
      },
      maybeSingle: async () => ({ data: recent, error: null }),
      insert() {
        return {
          select() {
            return {
              single: async () => ({ data: { id: "request-new" }, error: null }),
            };
          },
        };
      },
      then(resolve: (value: { count: number; error: null }) => void) {
        return Promise.resolve(resolve({ count: counts.shift() ?? 0, error: null }));
      },
    }),
  };
}
