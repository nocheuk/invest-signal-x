import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => ({
  scanRuns: [] as Array<{
    id: string;
    source_name: string;
    location_query: string;
    started_at: string;
    finished_at: string;
    metadata: Record<string, unknown>;
  }>,
  sourceLinks: [
    { deal_id: "imp-rightmove-1", import_sources: { name: "Rightmove Commercial" } },
    { deal_id: "imp-rightmove-2", import_sources: { name: "Rightmove Commercial" } },
    { deal_id: "imp-acuitus-1", import_sources: { name: "Acuitus" } },
  ],
  dealCount: 42,
}));

function resetRows() {
  rows.scanRuns = [{
    id: "scan-1",
    source_name: "Rightmove Commercial",
    location_query: "Bournemouth",
    started_at: "2026-05-28T04:59:00Z",
    finished_at: "2026-05-28T05:03:00Z",
    metadata: {
      locations_scanned: ["London", "Manchester", "Birmingham", "Leeds"],
      total_configured_locations: 160,
      next_index: 4,
      estimated_full_cycle_days: 40,
      scan_cycle_progress: 3,
    },
  }];
  rows.dealCount = 42;
}

const calls = vi.hoisted(() => ({
  tables: [] as string[],
  status: "",
  orderColumn: "",
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  requireSupabase: () => ({
    from: (table: string) => {
      calls.tables.push(table);
      if (table === "deals") {
        return {
          select: async () => ({ count: rows.dealCount, error: null }),
        };
      }
      if (table === "deal_source_links") {
        return {
          select: async () => ({ data: rows.sourceLinks, error: null }),
        };
      }
      return {
        select: () => ({
          eq: (_column: string, value: string) => {
            calls.status = value;
            return {
              order: (column: string) => {
                calls.orderColumn = column;
                return {
                  limit: async () => ({ data: rows.scanRuns, error: null }),
                };
              },
            };
          },
        }),
      };
    },
  }),
}));

import { formatNationalScanTime, useNationalScanStatus } from "@/hooks/useNationalScanStatus";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useNationalScanStatus", () => {
  beforeEach(() => {
    resetRows();
    calls.tables = [];
    calls.status = "";
    calls.orderColumn = "";
  });

  it("loads the latest completed national scan run", async () => {
    const { result } = renderHook(() => useNationalScanStatus(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls).toMatchObject({
      status: "completed",
      orderColumn: "finished_at",
    });
    expect(calls.tables).toEqual(["national_scan_runs", "deal_source_links", "deals"]);
    expect(result.current.data).toMatchObject({
      id: "scan-1",
      sourceName: "Rightmove Commercial",
      locationQuery: "Bournemouth",
      finishedAt: "2026-05-28T05:03:00Z",
      locationsScanned: ["London", "Manchester", "Birmingham", "Leeds"],
      totalConfiguredLocations: 160,
      nextIndex: 4,
      estimatedFullCycleDays: 40,
      scanCycleProgress: 3,
      totalDeals: 42,
      totalRightmoveDeals: 2,
      totalAcuitusDeals: 1,
      locationsCompletedInCurrentCycle: 4,
    });
  });

  it("returns null when no completed scan has run", async () => {
    rows.scanRuns = [];
    const { result } = renderHook(() => useNationalScanStatus(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("formats scan times in UK time", () => {
    expect(formatNationalScanTime("2026-05-28T05:03:00Z")).toContain("06:03");
  });
});
