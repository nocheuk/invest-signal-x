import { describe, expect, it } from "vitest";
import { extractInvestmentFacts } from "../../../scripts/lib/investmentDataExtraction.mjs";

describe("investment data extraction", () => {
  it("extracts ASDA-style tenant, lease expiry, passing rent and rent review facts", () => {
    const facts = extractInvestmentFacts({
      now: new Date("2026-06-11T00:00:00Z"),
      text: `
        Asda Stores Ltd, St Nicholas Gate Retail Park, London Road, Carlisle, Cumberland.
        Long Let Asda Superstore Investment.
        Let to ASDA Stores Ltd until May 2038 (no breaks).
        Current passing rent £771,722 pa.
        Fixed rental increases to £894,657 pa in 2028 and £1,037,175 pa in 2033.
      `,
    });

    expect(facts.tenantName).toBe("ASDA Stores Ltd");
    expect(facts.passingRent).toBe(771722);
    expect(facts.leaseExpiryText).toBe("May 2038");
    expect(facts.leaseLength).toBeCloseTo(12, 0);
    expect(facts.wault).toBeCloseTo(12, 0);
    expect(facts.rentReviewDates).toEqual([2028, 2033]);
    expect(facts.rentReviewAmounts).toEqual([894657, 1037175]);
    expect(facts.covenantStrength).toBe("Strong");
  });

  it("does not treat future rent review uplifts as current passing rent", () => {
    const facts = extractInvestmentFacts({
      text: "Let to ASDA Stores Ltd until May 2038. Fixed rental increases to £894,657 pa in 2028 and £1,037,175 pa in 2033.",
    });

    expect(facts.tenantName).toBe("ASDA Stores Ltd");
    expect(facts.passingRent).toBeUndefined();
    expect(facts.rentReviewAmounts).toEqual([894657, 1037175]);
  });
});
