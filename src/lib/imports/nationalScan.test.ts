import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  aggregateNationalResults,
  ENGLAND_PRIORITY_LOCATIONS,
  runNationalScan,
  selectNationalScanBatch,
  verifyCronSecret,
} from "../../../scripts/lib/nationalScan.mjs";

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

  it("rotates priority locations in conservative batches", () => {
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

  it("aggregates per-location and per-source scan results", async () => {
    const calls: string[] = [];
    const result = await runNationalScan({
      dryRun: true,
      batchSize: 2,
      locations: ["London", "Manchester", "Birmingham"],
      adapters: {
        rightmove: async ({ locationQuery }: { locationQuery: string }) => {
          calls.push(`rightmove:${locationQuery}`);
          return { source: "Rightmove Commercial", inserted: 1, existing: 2, failed: 0, skipped_duplicate: 2, processed: 1, total: 3, unique: 3 };
        },
        acuitus: async () => {
          calls.push("acuitus");
          return { source: "Acuitus", inserted: 3, existing: 4, failed: 1, skipped_duplicate: 4, processed: 3, total: 8, unique: 7 };
        },
      },
    });

    expect(calls).toEqual(["rightmove:London", "rightmove:Manchester", "acuitus"]);
    expect(result.locations).toEqual(["London", "Manchester"]);
    expect(result.nextIndex).toBe(2);
    expect(result.totals).toMatchObject({
      inserted: 5,
      existing: 8,
      failed: 1,
      skippedDuplicate: 8,
    });
  });

  it("records live scan rows and uses the previous next index", async () => {
    const supabase = createNationalScanSupabaseMock({ lastNextIndex: 1 });
    const result = await runNationalScan({
      supabase,
      batchSize: 2,
      locations: ["London", "Manchester", "Birmingham"],
      includeAcuitus: false,
      evaluateAlerts: false,
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
  });

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
