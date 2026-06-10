import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  aggregateNationalResults,
  buildNationalScanDiagnostics,
  ENGLAND_PRIORITY_LOCATIONS,
  EXPANDED_NATIONAL_SOURCE_KEYS,
  NATIONAL_SCAN_BATCH_SIZE,
  runNationalScan,
  selectNationalScanBatch,
  verifyCronSecret,
} from "../../../scripts/lib/nationalScan.mjs";
import { OFFICIAL_ENGLISH_CITIES } from "../../../scripts/lib/englandLocationQueue.mjs";
import { recommendBatchSize } from "../../../scripts/benchmark-national-scan.mjs";

describe("national scan scheduler", () => {
  it("authenticates cron requests using CRON_SECRET", () => {
    expect(verifyCronSecret({
      authorizationHeader: "Bearer secret",
      env: { CRON_SECRET: "secret" },
    })).toMatchObject({ ok: true });

    expect(verifyCronSecret({
      authorizationHeader: "Bearer wrong",
      env: { CRON_SECRET: "secret" },
    })).toMatchObject({ ok: false, status: 401 });

    expect(verifyCronSecret({ env: {} })).toMatchObject({ ok: false, status: 500 });
  });

  it("contains a broad England location queue with official cities and no duplicates", () => {
    expect(OFFICIAL_ENGLISH_CITIES.length).toBeGreaterThanOrEqual(55);
    for (const city of ["London", "Manchester", "Birmingham", "Leeds", "Southampton", "Westminster", "Wells"]) {
      expect(OFFICIAL_ENGLISH_CITIES).toContain(city);
      expect(ENGLAND_PRIORITY_LOCATIONS).toContain(city);
    }
    for (const town of ["Bournemouth", "Poole", "Reading", "Warrington", "Watford"]) {
      expect(ENGLAND_PRIORITY_LOCATIONS).toContain(town);
    }
    const normalized = ENGLAND_PRIORITY_LOCATIONS.map((location) => location.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
    expect(new Set(normalized).size).toBe(ENGLAND_PRIORITY_LOCATIONS.length);
    expect(ENGLAND_PRIORITY_LOCATIONS.length).toBeGreaterThan(100);
  });

  it("rotates England locations in conservative batches", () => {
    expect(ENGLAND_PRIORITY_LOCATIONS).toContain("London");
    expect(ENGLAND_PRIORITY_LOCATIONS).toContain("Bournemouth");
    expect(ENGLAND_PRIORITY_LOCATIONS).toContain("Hampshire");

    expect(selectNationalScanBatch({
      lastNextIndex: 0,
      batchSize: 4,
      locations: ["London", "Manchester", "Birmingham", "Leeds", "Poole"],
    })).toEqual({
      locations: ["London", "Manchester", "Birmingham", "Leeds"],
      startIndex: 0,
      nextIndex: 4,
    });

    expect(selectNationalScanBatch({
      lastNextIndex: 4,
      batchSize: 3,
      locations: ["London", "Manchester", "Birmingham", "Leeds", "Poole"],
    })).toEqual({
      locations: ["Poole", "London", "Manchester"],
      startIndex: 4,
      nextIndex: 2,
    });
  });

  it("reports scan coverage diagnostics for the dashboard", () => {
    const batch = selectNationalScanBatch({
      lastNextIndex: 4,
      batchSize: 4,
      locations: ENGLAND_PRIORITY_LOCATIONS,
    });
    const diagnostics = buildNationalScanDiagnostics({
      batch,
      batchSize: 4,
      totalLocations: ENGLAND_PRIORITY_LOCATIONS.length,
    });

    expect(diagnostics.totalConfiguredLocations).toBe(ENGLAND_PRIORITY_LOCATIONS.length);
    expect(diagnostics.locationsScannedCount).toBe(4);
    expect(diagnostics.nextIndex).toBe(8);
    expect(diagnostics.estimatedFullCycleDays).toBe(Math.ceil(ENGLAND_PRIORITY_LOCATIONS.length / 4));
  });

  it("uses the measured safe Hobby batch size by default", () => {
    expect(NATIONAL_SCAN_BATCH_SIZE).toBe(16);
    expect(Math.ceil(ENGLAND_PRIORITY_LOCATIONS.length / NATIONAL_SCAN_BATCH_SIZE)).toBe(10);
  });

  it("recommends the largest batch inside the configured cron safety budget", () => {
    expect(recommendBatchSize([
      { batchSize: 4, durationSeconds: 5.63 },
      { batchSize: 8, durationSeconds: 8.9 },
      { batchSize: 12, durationSeconds: 11.59 },
      { batchSize: 16, durationSeconds: 14.39 },
    ], { maxDurationSeconds: 60 })).toMatchObject({ batchSize: 16 });
  });

  it("aggregates per-location and per-source scan results", async () => {
    const calls: string[] = [];
    const result = await runNationalScan({
      dryRun: true,
      batchSize: 2,
      locations: ["London", "Manchester", "Birmingham"],
      includeExpandedSources: false,
      adapters: {
        rightmove: async ({ locationQuery }: { locationQuery: string }) => {
          calls.push(`rightmove:${locationQuery}`);
          return { source: "Rightmove Commercial", inserted: 1, existing: 2, failed: 0, skipped_duplicate: 2, processed: 1, total: 3, unique: 3 };
        },
        acuitus: async () => {
          calls.push("acuitus");
          return { source: "Acuitus", inserted: 3, existing: 4, failed: 1, skipped_duplicate: 4, processed: 3, total: 8, unique: 7 };
        },
        eddisons: async () => {
          calls.push("eddisons");
          return { source: "Eddisons", inserted: 2, existing: 1, failed: 0, skipped_duplicate: 1, processed: 2, total: 4, unique: 3 };
        },
        allsop: async () => {
          calls.push("allsop");
          return { source: "Allsop", inserted: 4, existing: 2, failed: 1, skipped_duplicate: 2, processed: 4, total: 7, unique: 6 };
        },
      },
    });

    expect(calls).toEqual(["rightmove:London", "rightmove:Manchester", "acuitus", "eddisons", "allsop"]);
    expect(result.locations).toEqual(["London", "Manchester"]);
    expect(result.nextIndex).toBe(2);
    expect(result.diagnostics).toMatchObject({
      totalConfiguredLocations: 3,
      locationsScanned: ["London", "Manchester"],
      nextIndex: 2,
    });
    expect(result.totals).toMatchObject({
      inserted: 11,
      existing: 11,
      failed: 2,
      skippedDuplicate: 11,
    });
  });

  it("records live scan rows and uses the previous next index", async () => {
    const supabase = createNationalScanSupabaseMock({ lastNextIndex: 1 });
    const result = await runNationalScan({
      supabase,
      batchSize: 2,
      locations: ["London", "Manchester", "Birmingham"],
      includeAcuitus: false,
      includeEddisons: false,
      includeAllsop: false,
      includeExpandedSources: false,
      evaluateAlerts: false,
      evaluateEnrichment: false,
      adapters: {
        rightmove: async ({ locationQuery }: { locationQuery: string }) => ({
          source: "Rightmove Commercial",
          inserted: locationQuery === "Manchester" ? 1 : 0,
          existing: 1,
          failed: 0,
          skipped_duplicate: 1,
          processed: 1,
          total: 2,
          unique: 2,
        }),
        acuitus: async () => ({ source: "Acuitus" }),
      },
    });

    expect(result.locations).toEqual(["Manchester", "Birmingham"]);
    expect(result.nextIndex).toBe(0);
    expect(supabase.inserts).toHaveLength(2);
    expect(supabase.updates).toHaveLength(2);
    expect(supabase.inserts[0]).toMatchObject({
      location_query: "Manchester",
      source_name: "Rightmove Commercial",
      metadata: expect.objectContaining({ next_index: 0 }),
    });
    expect(supabase.updates[0]).toMatchObject({ status: "completed", existing: 1 });
  });

  it("imports the Vercel cron route with plain Node", () => {
    const output = execFileSync(process.execPath, [
      "-e",
      "import('./api/cron/national-scan.mjs').then(() => process.stdout.write('ok'))",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    expect(output).toBe("ok");
  }, 15000);

  it("sums duplicate refreshes without implying duplicate deals are created", () => {
    expect(aggregateNationalResults([
      { inserted: 0, existing: 10, skippedDuplicate: 10, failed: 0 },
      { inserted: 2, existing: 3, skippedDuplicate: 3, failed: 1 },
    ])).toMatchObject({
      inserted: 2,
      existing: 13,
      skippedDuplicate: 13,
      failed: 1,
    });
  });

  it("includes expanded commercial sources in national scans", async () => {
    const calls: string[] = [];
    const expandedAdapters = Object.fromEntries(EXPANDED_NATIONAL_SOURCE_KEYS.map((sourceKey) => [
      sourceKey,
      async () => {
        calls.push(sourceKey);
        return { source: sourceKey, inserted: 1, existing: 0, failed: 0, processed: 1, total: 1, unique: 1 };
      },
    ]));

    await runNationalScan({
      dryRun: true,
      batchSize: 1,
      locations: ["London"],
      includeAcuitus: false,
      includeEddisons: false,
      includeAllsop: false,
      adapters: {
        rightmove: async () => ({ source: "Rightmove Commercial", inserted: 0, existing: 0, failed: 0 }),
        ...expandedAdapters,
      },
    });

    expect(calls).toEqual(EXPANDED_NATIONAL_SOURCE_KEYS);
  });

  it("runs Rightmove every scan and skips non-due static sources", async () => {
    const calls: string[] = [];
    const result = await runNationalScan({
      dryRun: true,
      now: new Date("2026-06-10T12:00:00Z"),
      batchSize: 1,
      locations: ["London"],
      includeEddisons: false,
      includeAllsop: false,
      includeExpandedSources: false,
      sourceScanHistory: [
        {
          sourceName: "Rightmove Commercial",
          status: "completed",
          startedAt: "2026-06-10T11:00:00Z",
          finishedAt: "2026-06-10T11:05:00Z",
          errorMessage: null,
        },
        {
          sourceName: "Acuitus",
          status: "completed",
          startedAt: "2026-06-10T06:00:00Z",
          finishedAt: "2026-06-10T06:04:00Z",
          errorMessage: null,
        },
      ],
      adapters: {
        rightmove: async ({ locationQuery }: { locationQuery: string }) => {
          calls.push(`rightmove:${locationQuery}`);
          return { source: "Rightmove Commercial", inserted: 1, existing: 0, failed: 0, processed: 1 };
        },
        acuitus: async () => {
          calls.push("acuitus");
          return { source: "Acuitus", inserted: 1, existing: 0, failed: 0, processed: 1 };
        },
      },
    });

    expect(calls).toEqual(["rightmove:London"]);
    expect(result.skippedSources).toEqual([
      expect.objectContaining({
        sourceName: "Acuitus",
        status: "skipped",
        skippedReason: "cooldown",
      }),
    ]);
  });

  it("backs off blocked/problematic sources without blocking due dynamic sources", async () => {
    const calls: string[] = [];
    const result = await runNationalScan({
      dryRun: true,
      now: new Date("2026-06-10T12:00:00Z"),
      batchSize: 1,
      locations: ["London"],
      includeAcuitus: false,
      includeEddisons: false,
      includeAllsop: false,
      includeExpandedSources: true,
      sourceScanHistory: [
        {
          sourceName: "Zoopla Commercial",
          status: "failed",
          startedAt: "2026-06-09T12:00:00Z",
          finishedAt: "2026-06-09T12:01:00Z",
          errorMessage: "Fetch failed: 403 Forbidden",
        },
        {
          sourceName: "Pugh Auctions",
          status: "completed",
          startedAt: "2026-06-09T22:00:00Z",
          finishedAt: "2026-06-09T22:10:00Z",
          errorMessage: null,
        },
      ],
      adapters: {
        rightmove: async () => ({ source: "Rightmove Commercial", inserted: 0, existing: 0, failed: 0 }),
        goadsby: async () => ({ source: "Goadsby Commercial", inserted: 0, existing: 0, failed: 0 }),
        zoopla: async () => {
          calls.push("zoopla");
          return { source: "Zoopla Commercial", inserted: 0, existing: 0, failed: 0 };
        },
        savills: async () => ({ source: "Savills Commercial", inserted: 0, existing: 0, failed: 0 }),
        sdl: async () => ({ source: "SDL Property Auctions", inserted: 0, existing: 0, failed: 0 }),
        pugh: async () => {
          calls.push("pugh");
          return { source: "Pugh Auctions", inserted: 1, existing: 0, failed: 0, processed: 1 };
        },
        bondWolfe: async () => ({ source: "Bond Wolfe", inserted: 0, existing: 0, failed: 0 }),
        fisherGerman: async () => ({ source: "Fisher German Commercial", inserted: 0, existing: 0, failed: 0 }),
        lsh: async () => ({ source: "Lambert Smith Hampton", inserted: 0, existing: 0, failed: 0 }),
      },
    });

    expect(calls).toEqual(["pugh"]);
    expect(result.skippedSources).toContainEqual(expect.objectContaining({
      sourceName: "Zoopla Commercial",
      skippedReason: "blocked_backoff",
    }));
  });
});

function createNationalScanSupabaseMock({ lastNextIndex = 0 } = {}) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  return {
    inserts,
    updates,
    from(table: string) {
      if (table !== "national_scan_runs") throw new Error(`Unexpected table ${table}`);
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          return this;
        },
        limit: async () => ({ data: [{ metadata: { next_index: lastNextIndex } }], error: null }),
        insert(payload: unknown) {
          inserts.push(payload);
          return {
            select() {
              return {
                single: async () => ({ data: { id: `scan-${inserts.length}` }, error: null }),
              };
            },
          };
        },
        update(payload: unknown) {
          updates.push(payload);
          return {
            eq: async () => ({ error: null }),
          };
        },
      };
    },
  };
}
