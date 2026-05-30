import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import {
  buildRightmoveCommercialSearchUrl,
  aggregateSourceResults,
  prepareLocationSearchRequest,
  readBearerToken,
  requireAuthenticatedUser,
  runLiveLocationSourceSearches,
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
    expect(slugifyLocation("Burton upon Trent")).toBe("Burton-On-Trent");
    expect(buildRightmoveCommercialSearchUrl("Poole")).toBe("https://www.rightmove.co.uk/commercial-property-for-sale/Poole.html");
    expect(buildRightmoveCommercialSearchUrl("Hampshire")).toBe("https://www.rightmove.co.uk/commercial-property-for-sale/Hampshire.html");
    expect(buildRightmoveCommercialSearchUrl("Burton upon Trent")).toBe("https://www.rightmove.co.uk/commercial-property-for-sale/Burton-On-Trent.html");
  });

  it("reads bearer tokens without requiring frontend secrets", () => {
    expect(readBearerToken("Bearer abc.def")).toBe("abc.def");
    expect(readBearerToken("")).toBe("");

    const clientHook = fs.readFileSync(path.resolve("src/hooks/useLocationImport.ts"), "utf8");
    expect(clientHook).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(clientHook).not.toContain("runRightmoveCommercialImport");
    expect(clientHook).not.toContain("rightmoveCommercialScraper");
  });

  it("imports the Vercel API route with plain Node without a TS loader", () => {
    const output = execFileSync(process.execPath, [
      "-e",
      "import('./api/location-search.mjs').then(() => process.stdout.write('ok'))",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    expect(output).toBe("ok");
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

  it("allows repeated location searches within hourly and daily rate limits", async () => {
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
      ok: true,
      requestId: "request-new",
    });
  });

  it("runs both Rightmove and Acuitus adapters and aggregates per-source results", async () => {
    const calls: string[] = [];
    const result = await runLiveLocationSourceSearches({
      locationQuery: "Southampton",
      dryRun: false,
      adapters: [
        {
          key: "rightmove",
          sourceName: "Rightmove Commercial",
          run: async () => {
            calls.push("rightmove");
            return { source: "Rightmove Commercial", dryRun: false, total: 10, unique: 8, inserted: 2, existing: 3, failed: 1, skipped_duplicate: 3, processed: 2 };
          },
        },
        {
          key: "acuitus",
          sourceName: "Acuitus",
          run: async () => {
            calls.push("acuitus");
            return { source: "Acuitus", dryRun: false, total: 6, unique: 5, inserted: 4, existing: 1, failed: 0, skipped_duplicate: 1, processed: 4 };
          },
        },
      ],
    });

    expect(calls).toEqual(["rightmove", "acuitus"]);
    expect(result.sources.rightmove).toMatchObject({ inserted: 2, existing: 3, skippedDuplicate: 3 });
    expect(result.sources.acuitus).toMatchObject({ inserted: 4, existing: 1, skippedDuplicate: 1 });
    expect(result).toMatchObject({
      totalInserted: 6,
      totalExisting: 4,
      totalFailed: 1,
      totalSkippedDuplicate: 4,
    });
  });

  it("aggregates failed source adapters without hiding successful sources", () => {
    const result = aggregateSourceResults({
      locationQuery: "Poole",
      sources: {
        rightmove: { source: "Rightmove Commercial", dryRun: false, total: 2, unique: 2, inserted: 1, existing: 1, failed: 0, skippedDuplicate: 1, processed: 1 },
        acuitus: { source: "Acuitus", dryRun: false, total: 0, unique: 0, inserted: 0, existing: 0, failed: 1, skippedDuplicate: 0, processed: 0, error: "HTML fetch failed" },
      },
    });

    expect(result.totalInserted).toBe(1);
    expect(result.totalExisting).toBe(1);
    expect(result.totalFailed).toBe(1);
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
