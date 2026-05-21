import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildRightmoveCommercialSearchUrl,
  readBearerToken,
  requireAdminUser,
  slugifyLocation,
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

  it("requires a verified admin user for live location imports", async () => {
    authUser.user = { id: "admin-1", app_metadata: { role: "admin" } };
    authUser.error = null;

    await expect(requireAdminUser({
      authorizationHeader: "Bearer token",
      env: { VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: "anon" },
    })).resolves.toMatchObject({ ok: true });

    authUser.user = { id: "user-1", app_metadata: { role: "member" } };
    await expect(requireAdminUser({
      authorizationHeader: "Bearer token",
      env: { VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: "anon" },
    })).resolves.toMatchObject({ ok: false, status: 403 });
  });
});
