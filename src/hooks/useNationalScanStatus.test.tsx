import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => ({
  value: [{
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
  }],
}));

const calls = vi.hoisted(() => ({
  table: "",
  status: "",
  orderColumn: "",
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  requireSupabase: () => ({
    from: (table: string) => {
      calls.table = table;
      return {
        select: () => ({
          eq: (_column: string, value: string) => {
            calls.status = value;
            return {
              order: (column: string) => {
                calls.orderColumn = column;
                return {
                  limit: async () => ({ data: rows.value, error: null }),
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
  it("loads the latest completed national scan run", async () => {
    const { result } = renderHook(() => useNationalScanStatus(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls).toMatchObject({
      table: "national_scan_runs",
      status: "completed",
      orderColumn: "finished_at",
    });
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
    });
  });

  it("returns null when no completed scan has run", async () => {
    rows.value = [];
    const { result } = renderHook(() => useNationalScanStatus(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("formats scan times in UK time", () => {
    expect(formatNationalScanTime("2026-05-28T05:03:00Z")).toContain("06:03");
  });
});
