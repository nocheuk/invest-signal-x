import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => ({
  scanRuns: [] as Array<{
    id: string;
    source_name: string;
    location_query: string;
    status?: string;
    started_at: string;
    finished_at: string;
    inserted: number;
    existing?: number;
    failed?: number;
    skipped_duplicate?: number;
    skipped_rent_only?: number;
    skipped_poa?: number;
    error_message?: string | null;
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
  enrichments: [
    { id: "enrich-1", deal_id: "imp-allsop-1", source_url: "https://www.allsop.co.uk/investment-overview/property/ci00436", status: "enriched", next_attempt_at: null, tenant_name: "Tenant Ltd", passing_rent: 85000, lease_length: 6, wault: 5, epc_rating: "B", sqft: 4000, guide_price: 1000000, auction_info: {}, vat_info: "VAT applicable", investment_summary: "Investment summary" },
    { id: "enrich-2", deal_id: "imp-rightmove-1", source_url: "https://www.rightmove.co.uk/commercial-property-for-sale/property-1.html", status: "failed", next_attempt_at: "2026-01-01T00:00:00Z", tenant_name: null, passing_rent: null, lease_length: null, wault: null, epc_rating: null, sqft: null, guide_price: null, auction_info: {}, vat_info: null, investment_summary: null },
    { id: "enrich-3", deal_id: "imp-acuitus-1", source_url: "https://www.acuitus.co.uk/property", status: "pending", next_attempt_at: "2026-01-01T00:00:00Z", tenant_name: null, passing_rent: null, lease_length: null, wault: null, epc_rating: null, sqft: null, guide_price: null, auction_info: {}, vat_info: null, investment_summary: null },
  ],
  deals: [] as Array<Record<string, unknown>>,
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
        status: "completed",
        existing: 12,
        failed: 0,
        skipped_duplicate: 12,
        skipped_rent_only: 1,
        skipped_poa: 0,
        error_message: null,
  }];
  rows.dealCount = 42;
  rows.enrichments = [
    { id: "enrich-1", deal_id: "imp-allsop-1", source_url: "https://www.allsop.co.uk/investment-overview/property/ci00436", status: "enriched", next_attempt_at: null, tenant_name: "Tenant Ltd", passing_rent: 85000, lease_length: 6, wault: 5, epc_rating: "B", sqft: 4000, guide_price: 1000000, auction_info: {}, vat_info: "VAT applicable", investment_summary: "Investment summary" },
    { id: "enrich-2", deal_id: "imp-rightmove-1", source_url: "https://www.rightmove.co.uk/commercial-property-for-sale/property-1.html", status: "failed", next_attempt_at: "2026-01-01T00:00:00Z", tenant_name: null, passing_rent: null, lease_length: null, wault: null, epc_rating: null, sqft: null, guide_price: null, auction_info: {}, vat_info: null, investment_summary: null },
    { id: "enrich-3", deal_id: "imp-acuitus-1", source_url: "https://www.acuitus.co.uk/property", status: "pending", next_attempt_at: "2026-01-01T00:00:00Z", tenant_name: null, passing_rent: null, lease_length: null, wault: null, epc_rating: null, sqft: null, guide_price: null, auction_info: {}, vat_info: null, investment_summary: null },
  ];
  rows.deals = [
    dealRow({ id: "imp-allsop-1", importSourceName: "Allsop", score: 74, dataConfidenceScore: 78, passingRent: 85000, tenant: "Tenant Ltd", wault: 5, leaseLength: 6, sqft: 4000, netInitialYield: 8.5 }),
    dealRow({ id: "imp-rightmove-1", importSourceName: "Rightmove Commercial" }),
    dealRow({ id: "imp-acuitus-1", importSourceName: "Acuitus" }),
  ];
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

function dealRow({
  id,
  importSourceName,
  score = 45,
  dataConfidenceScore = 40,
  passingRent = 0,
  tenant = "Unknown",
  wault = 0,
  leaseLength = 0,
  sqft = 0,
  netInitialYield = 0,
}: {
  id: string;
  importSourceName: string;
  score?: number;
  dataConfidenceScore?: number;
  passingRent?: number;
  tenant?: string;
  wault?: number;
  leaseLength?: number;
  sqft?: number;
  netInitialYield?: number;
}) {
  return {
    id,
    title: `${importSourceName} deal`,
    location: "Bournemouth BH1",
    region: "Dorset",
    asset_type: "Retail",
    source: "Auction",
    guide_price: 1000000,
    passing_rent: passingRent,
    sqft,
    gross_yield: passingRent > 0 ? 8.5 : 0,
    net_initial_yield: netInitialYield,
    reversionary_yield: netInitialYield,
    wault,
    lease_length: leaseLength,
    tenant,
    covenant_strength: "Moderate",
    tenant_health_score: 60,
    rent_sustainability: "Market rent",
    rent_review: "None",
    price_per_sqft: sqft > 0 ? 250 : 0,
    planning_upside_score: 40,
    void_risk_score: 40,
    exit_yield_sensitivity: "Moderate",
    cashflow_after_debt: 0,
    return_on_equity: 0,
    auction_guide_risk: null,
    red_flags: [],
    main_risk_flag: "Imported",
    score,
    rating: score >= 78 ? "green" : score >= 60 ? "amber" : "red",
    score_breakdown: { incomeQuality: 70, tenantSecurity: 60, marketPricing: 70, upside: 40, riskExit: 60 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    posted_at: "2026-06-10T08:00:00Z",
    created_at: "2026-06-10T08:00:00Z",
    updated_at: "2026-06-10T08:00:00Z",
    import_source_name: importSourceName,
    data_confidence_score: dataConfidenceScore,
  };
}

const calls = vi.hoisted(() => ({
  tables: [] as string[],
  status: "",
  orderColumns: [] as string[],
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  requireSupabase: () => ({
    from: (table: string) => {
      calls.tables.push(table);
      if (table === "deals") {
        return {
          select: (_columns?: string, options?: { head?: boolean }) => {
            if (options?.head) return Promise.resolve({ count: rows.dealCount, error: rows.dealCountError ? { message: rows.dealCountError } : null });
            return {
              in: async (_column: string, values: string[]) => ({ data: rows.deals.filter((deal) => values.includes(String(deal.id))), error: null }),
            };
          },
        };
      }
      if (table === "deal_source_links") {
        return {
          select: () => ({
            range: async (from: number, to: number) => ({
              data: rows.sourceLinksError ? null : rows.sourceLinks.slice(from, to + 1),
              error: rows.sourceLinksError ? { message: rows.sourceLinksError } : null,
            }),
            in: async (_column: string, values: string[]) => ({
              data: rows.sourceLinks.filter((link) => values.includes(link.deal_id)),
              error: null,
            }),
          }),
        };
      }
      if (table === "deal_enrichments") {
        const result = { data: rows.enrichments, error: null };
        return {
          select: () => ({
            range: async (from: number, to: number) => ({ data: rows.enrichments.slice(from, to + 1), error: null }),
            then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
          }),
        };
      }
      return {
        select: () => ({
          order: (column: string) => {
            calls.orderColumns.push(column);
            return {
              limit: async () => ({ data: rows.scanRuns, error: null }),
            };
          },
          eq: (_column: string, value: string) => {
            calls.status = value;
            return {
              order: (column: string) => {
                calls.orderColumns.push(column);
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
    calls.orderColumns = [];
  });

  it("loads the latest completed national scan run", async () => {
    const { result } = renderHook(() => useNationalScanStatus(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls).toMatchObject({
      status: "completed",
    });
    expect(calls.orderColumns).toEqual(["finished_at", "started_at"]);
    expect(calls.tables).toEqual([
      "national_scan_runs",
      "deal_source_links",
      "deals",
      "national_scan_runs",
      "deal_enrichments",
      "deal_enrichments",
      "deals",
      "deal_source_links",
    ]);
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
      enrichmentMetrics: {
        total: 3,
        enriched: 1,
        failed: 1,
        pending: 1,
        queueSize: 4,
        successRate: 33.3,
      },
      enrichmentImpact: {
        totalEnriched: 1,
        tenantFound: 1,
        rentFound: 1,
        leaseFound: 1,
        waultFound: 1,
        epcFound: 1,
        areaFound: 1,
      },
      sourceScanRuns: [
        expect.objectContaining({
          sourceName: "Rightmove Commercial",
          status: "completed",
          inserted: 7,
          existing: 12,
        }),
      ],
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
    expect(calls.tables.filter((table) => table === "deal_source_links")).toHaveLength(3);
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
