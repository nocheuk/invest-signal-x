import { describe, expect, it } from "vitest";
import { buildSourceOpportunityAudit, SOURCE_OPPORTUNITY_AUDIT_INPUTS } from "@/lib/sourceOpportunityAudit";

describe("source opportunity audit", () => {
  it("produces ranked source recommendations from evidence inputs", () => {
    const audit = buildSourceOpportunityAudit(SOURCE_OPPORTUNITY_AUDIT_INPUTS);

    expect(audit[0]).toMatchObject({
      source: "Pugh Auctions",
      recommendation: "Build immediately",
      currentBlockingReason: "no issue",
    });
    expect(audit.find((row) => row.source === "Zoopla Commercial")).toMatchObject({
      currentBlockingReason: "403",
      engineeringDifficulty: "High",
      recommendation: "Not worth pursuing yet",
    });
    expect(audit.every((row, index) => index === 0 || audit[index - 1].rankScore >= row.rankScore)).toBe(true);
  });
});
