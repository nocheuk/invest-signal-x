import { describe, expect, it, vi } from "vitest";

const insert = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: () => ({ insert }),
  },
}));

describe("trackUserEvent", () => {
  it("does not throw when event logging fails", async () => {
    const { trackUserEvent } = await import("@/lib/usageTracking");
    insert.mockResolvedValueOnce({ error: new Error("network failed") });

    await expect(trackUserEvent("user-1", {
      eventType: "opened_deal",
      dealId: "deal-1",
      currentPage: "/deal/deal-1",
    })).resolves.toBeUndefined();
  });

  it("does nothing when no user id is available", async () => {
    const { trackUserEvent } = await import("@/lib/usageTracking");
    insert.mockClear();

    await trackUserEvent(null, {
      eventType: "opened_deal",
      dealId: "deal-1",
      currentPage: "/deal/deal-1",
    });

    expect(insert).not.toHaveBeenCalled();
  });
});
