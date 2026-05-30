import { describe, expect, it, vi } from "vitest";
import { alertMatchesDeal, buildAlertEmailPayload, normalizeAlert, normalizeDeal, runSavedAlertsForRecentDeals } from "../../../scripts/lib/alerts.mjs";

describe("saved alert runner", () => {
  it("matches normalized server-side alert criteria", () => {
    const result = alertMatchesDeal(
      normalizeAlert({ name: "Bournemouth", location_query: "Bournemouth", min_yield: 7, max_price: 1500000, asset_type: "Retail", min_score: 70, enabled: true }),
      normalizeDeal({ id: "imp-1", title: "Retail", location: "Bournemouth, BH1", asset_type: "Retail", guide_price: 1000000, net_initial_yield: 8.2, score: 82 })
    );

    expect(result.matches).toBe(true);
    expect(result.reasons).toEqual(expect.arrayContaining(["Location matches Bournemouth", "Score 82 meets minimum 70"]));
  });

  it("suppresses duplicate alert matches for the same alert and deal", async () => {
    const supabase = createAlertSupabaseMock({
      existingMatches: [{ deal_id: "imp-duplicate" }],
    });
    const sendEmail = vi.fn(async () => ({ sent: true, status: "sent" }));

    const result = await runSavedAlertsForRecentDeals({
      supabase,
      since: "2026-05-30T05:00:00Z",
      appUrl: "https://app.dealsignal.test",
      sendEmail,
    });

    expect(result).toMatchObject({ dealsMatched: 1, duplicateMatches: 1, emailsSent: 1 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(supabase.calls.matchesInserted).toEqual([
      expect.objectContaining({ alert_id: "alert-1", deal_id: "imp-new", email_sent: true }),
    ]);
    expect(supabase.calls.runUpdates[0]).toMatchObject({ status: "completed", deals_matched: 1, emails_sent: 1 });
  });

  it("builds provider-ready email payloads", () => {
    const payload = buildAlertEmailPayload({
      alert: normalizeAlert({ name: "Bournemouth retail" }),
      deals: [normalizeDeal({ id: "imp-1", title: "Retail lot", location: "Bournemouth", asset_type: "Retail", guide_price: 1000000, net_initial_yield: 8, score: 80 })],
      appUrl: "https://app.dealsignal.test",
    });

    expect(payload.subject).toContain("Bournemouth retail");
    expect(payload.text).toContain("Retail lot");
    expect(payload.html).toContain("Open deal");
  });
});

function createAlertSupabaseMock({ existingMatches = [] } = {}) {
  const calls = {
    matchesInserted: [] as unknown[],
    runUpdates: [] as unknown[],
  };

  const alerts = [{
    id: "alert-1",
    user_id: "user-1",
    name: "Bournemouth retail",
    location_query: "Bournemouth",
    min_yield: 7,
    max_price: 1500000,
    asset_type: "Retail",
    min_score: 70,
    enabled: true,
  }];
  const deals = [
    { id: "imp-duplicate", title: "Duplicate retail", location: "Bournemouth, BH1", region: "South West", asset_type: "Retail", guide_price: 1000000, net_initial_yield: 8.2, gross_yield: 8.2, score: 82, updated_at: "2026-05-30T06:00:00Z" },
    { id: "imp-new", title: "New retail", location: "Bournemouth, BH1", region: "South West", asset_type: "Retail", guide_price: 900000, net_initial_yield: 8.5, gross_yield: 8.5, score: 84, updated_at: "2026-05-30T06:00:00Z" },
    { id: "imp-office", title: "Office", location: "Bournemouth, BH1", region: "South West", asset_type: "Office", guide_price: 900000, net_initial_yield: 8.5, gross_yield: 8.5, score: 84, updated_at: "2026-05-30T06:00:00Z" },
  ];

  return {
    calls,
    from(table: string) {
      if (table === "alert_runs") {
        return {
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: "run-1" }, error: null }) }) }),
          update: (payload: unknown) => {
            calls.runUpdates.push(payload);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (table === "saved_alerts") {
        return {
          select: () => ({ eq: async () => ({ data: alerts, error: null }) }),
        };
      }
      if (table === "deals") {
        return {
          select: () => ({ gte: async () => ({ data: deals, error: null }) }),
        };
      }
      if (table === "deal_source_links") {
        return {
          select: () => ({ in: async () => ({ data: deals.map((deal) => ({ deal_id: deal.id })), error: null }) }),
        };
      }
      if (table === "alert_matches") {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({ data: existingMatches, error: null }),
            }),
          }),
          insert: (payload: unknown) => {
            calls.matchesInserted.push(payload);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}
