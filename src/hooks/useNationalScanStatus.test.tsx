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
    inserted: number;
    metadata: Record<string, unknown>;
  }>,
  sourceLinks: [
    { deal_id: "imp-rightmove-1", source_url: "https://www.rightmove.co.uk/commercial-property-for-sale/property-1.html", import_sources: { name: "Rightmove Commercial" }, raw_imports: null },
    { deal_id: "imp-rightmove-2", source_url: "", import_sources: { name: "Rightmove Commercial" }, raw_imports: null },
    { deal_id: "imp-acuitus-1", source_url: "https://www.acuitus.co.uk/property", import_sources: { name: "Acuitus" }, raw_imports: null },
    { deal_id: "imp-eddisons-1", source_url: "https://www.eddisons.com/property-search/commercial-property", import_sources: null, raw_imports: null },
    { deal_id: "imp-allsop-1", source_url: "https://www.allsop.co.uk/investment-overview/property/ci00436", import_sources: { name: "Allsop" }, raw_imports: null },
  ],
  dealCount: 42,
  sourceLinksError: null as string | null,
  dealCountError: null as string | null,
}));

function resetRows() {
  rows.scanRuns = [{
    id: "scan-1",
    source_name: "Rightmove Commercial",
    location_query: "Bournemouth",
    started_at: "2026-05-28T04:59:00Z",
    finished_at: "2026-05-28T05:03:00Z",
    inserted: 7,
    metadata: {
      locations_scanned: ["London", "Manchester", "Birmingham", "Leeds"],
      total_configured_locations: 160,
      next_index: 4,
      estimated_full_cycle_days: 40,
      scan_cycle_progress: 3,
    },
  }];
  rows.dealCount = 42;
  rows.sourceLinksError = null;
  rows.dealCountError = null;
  rows.sourceLinks = [
    { deal_id: "imp-rightmove-1", source_url: "https://www.rightmove.co.uk/commercial-property-for-sale/property-1.html", import_sources: { name: "Rightmove Commercial" }, raw_imports: null },
    { deal_id: "imp-rightmove-2", source_url: "", import_sources: { name: "Rightmove Commercial" }, raw_imports: null },
    { deal_id: "imp-acuitus-1", source_url: "https://www.acuitus.co.uk/property", import_sources: { name: "Acuitus" }, raw_imports: null },
    { deal_id: "imp-eddisons-1", source_url: "https://www.eddisons.com/property-search/commercial-property", import_sources: null, raw_imports: null },
    { deal_id: "imp-allsop-1", source_url: "https://www.allsop.co.uk/investment-overview/property/ci00436", import_sources: { name: "Allsop" }, raw_imports: null },
  ];
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
          select: async () => ({ count: rows.dealCount, error: rows.dealCountError ? { message: rows.dealCountError } : null }),
        };
      }
      if (table === "deal_source_links") {
        return {
          select: () => ({
            range: async (from: number, to: number) => ({
              data: rows.sourceLinksError ? null : rows.sourceLinks.slice(from, to + 1),
              error: rows.sourceLinksError ? { message: rows.sourceLinksError } : null,
            }),
          }),
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

import { formatNationalScanTime, formatScanDuration, useNationalScanStatus } from "@/hooks/useNationalScanStatus";

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
      totalEddisonsDeals: 1,
      totalAllsopDeals: 1,
      locationsCompletedInCurrentCycle: 4,
      lastSuccessfulScanDurationMs: 240000,
      lastScanInsertedCount: 7,
    });
  });

  it("returns null when no completed scan has run", async () => {
    rows.scanRuns = [];
    const { result } = renderHook(() => useNationalScanStatus(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("counts source links beyond Supabase's default 1000 row page", async () => {
    rows.sourceLinks = [
      ...Array.from({ length: 1000 }, (_, index) => ({
        deal_id: `imp-rightmove-${index}`,
        source_url: `https://www.rightmove.co.uk/commercial-property-for-sale/property-${index}.html`,
        import_sources: { name: "Rightmove Commercial" },
        raw_imports: null,
      })),
      { deal_id: "imp-eddisons-page-2", source_url: "https://www.eddisons.com/property-search/page-2", import_sources: { name: "Eddisons" }, raw_imports: null },
      { deal_id: "imp-allsop-page-2", source_url: "https://www.allsop.co.uk/investment-overview/property/ci00436", import_sources: null, raw_imports: null },
    ];

    const { result } = renderHook(() => useNationalScanStatus(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({
      totalRightmoveDeals: 1000,
      totalEddisonsDeals: 1,
      totalAllsopDeals: 1,
    });
    expect(calls.tables.filter((table) => table === "deal_source_links")).toHaveLength(2);
  });

  it("returns the scan row with safe count fallbacks when dashboard count queries fail", async () => {
    rows.sourceLinksError = "count query failed";
    rows.dealCountError = "deal count failed";
    const { result } = renderHook(() => useNationalScanStatus(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({
      id: "scan-1",
      totalDeals: 0,
      totalRightmoveDeals: 0,
      totalAcuitusDeals: 0,
      totalEddisonsDeals: 0,
      totalAllsopDeals: 0,
    });
  });

  it("formats scan times and durations", () => {
    expect(formatNationalScanTime("2026-05-28T05:03:00Z")).toContain("06:03");
    expect(formatScanDuration(240000)).toBe("4m");
    expect(formatScanDuration(245000)).toBe("4m 5s");
  });
});
