export type SourceBlockingReason =
  | "403"
  | "anti-bot"
  | "pagination"
  | "missing pricing"
  | "parser issue"
  | "no issue";

export type EngineeringDifficulty = "Low" | "Medium" | "High";
export type SourceRecommendation = "Build immediately" | "Build later" | "Not worth pursuing yet";

export type SourceOpportunityAuditInput = {
  source: string;
  estimatedTotalListings: number;
  estimatedCommercialAcquisitionListings: number;
  estimatedOverlapPct: number;
  currentBlockingReason: SourceBlockingReason;
  engineeringDifficulty: EngineeringDifficulty;
  evidence: string[];
};

export type SourceOpportunityAuditRow = SourceOpportunityAuditInput & {
  estimatedUniqueOpportunityPotential: number;
  recommendation: SourceRecommendation;
  rankScore: number;
};

export const SOURCE_OPPORTUNITY_AUDIT_INPUTS: SourceOpportunityAuditInput[] = [
  {
    source: "Pugh Auctions",
    estimatedTotalListings: 20,
    estimatedCommercialAcquisitionListings: 18,
    estimatedOverlapPct: 5,
    currentBlockingReason: "no issue",
    engineeringDifficulty: "Low",
    evidence: [
      "Dry-run discovered 40 source rows, deduped to 20 unique rows.",
      "17 rows processed, 1 existing overlap, 2 rows failed missing price.",
      "Live page check returned HTTP 200 and 20 listing cards.",
    ],
  },
  {
    source: "Bond Wolfe",
    estimatedTotalListings: 63,
    estimatedCommercialAcquisitionListings: 50,
    estimatedOverlapPct: 15,
    currentBlockingReason: "anti-bot",
    engineeringDifficulty: "Medium",
    evidence: [
      "Dry-run stopped on anti-bot block detection.",
      "Live page check returned HTTP 200 and 63 order-of-sale rows.",
      "Likely high auction acquisition relevance if block/false-positive detection is resolved.",
    ],
  },
  {
    source: "Savills Commercial",
    estimatedTotalListings: 16,
    estimatedCommercialAcquisitionListings: 16,
    estimatedOverlapPct: 10,
    currentBlockingReason: "parser issue",
    engineeringDifficulty: "Medium",
    evidence: [
      "Dry-run reached the page but parser returned 0 importable rows.",
      "Live page check returned HTTP 200 and 16 commercial sale cards.",
      "Current selectors need updating for Savills card/link structure.",
    ],
  },
  {
    source: "SDL Property Auctions",
    estimatedTotalListings: 5,
    estimatedCommercialAcquisitionListings: 5,
    estimatedOverlapPct: 10,
    currentBlockingReason: "missing pricing",
    engineeringDifficulty: "Medium",
    evidence: [
      "Dry-run discovered 5 rows.",
      "All 5 rows failed validation because guide price was not extracted.",
      "Live page check returned HTTP 200 and auction search cards.",
    ],
  },
  {
    source: "Lambert Smith Hampton",
    estimatedTotalListings: 7,
    estimatedCommercialAcquisitionListings: 6,
    estimatedOverlapPct: 20,
    currentBlockingReason: "missing pricing",
    engineeringDifficulty: "Medium",
    evidence: [
      "Dry-run discovered 7 rows and skipped 1 rent-only row.",
      "6 acquisition-looking rows failed because guide price was not extracted.",
      "Live page check returned HTTP 200 and 7 property cards.",
    ],
  },
  {
    source: "Fisher German Commercial",
    estimatedTotalListings: 12,
    estimatedCommercialAcquisitionListings: 8,
    estimatedOverlapPct: 20,
    currentBlockingReason: "anti-bot",
    engineeringDifficulty: "High",
    evidence: [
      "Dry-run stopped on anti-bot block detection.",
      "Live page check returned HTTP 200 and 12 commercial cards, but page content contains blocking hints.",
      "Source mixes sale and rent, so sale-only filtering would need refinement.",
    ],
  },
  {
    source: "Goadsby Commercial",
    estimatedTotalListings: 1,
    estimatedCommercialAcquisitionListings: 0,
    estimatedOverlapPct: 20,
    currentBlockingReason: "anti-bot",
    engineeringDifficulty: "High",
    evidence: [
      "Dry-run stopped on anti-bot block detection.",
      "Live page check returned HTTP 200 but only 1 broad selector match, not usable listing inventory.",
      "For-sale page appears to require a more site-specific flow before value is clear.",
    ],
  },
  {
    source: "Zoopla Commercial",
    estimatedTotalListings: 0,
    estimatedCommercialAcquisitionListings: 0,
    estimatedOverlapPct: 30,
    currentBlockingReason: "403",
    engineeringDifficulty: "High",
    evidence: [
      "Dry-run failed with HTTP 403 Forbidden.",
      "Live page check returned HTTP 403 and a challenge page.",
      "High theoretical inventory, but current server-side fetch path cannot access it reliably.",
    ],
  },
];

export function buildSourceOpportunityAudit(inputs: SourceOpportunityAuditInput[] = SOURCE_OPPORTUNITY_AUDIT_INPUTS) {
  return inputs
    .map((input) => {
      const estimatedUniqueOpportunityPotential = Math.max(
        0,
        Math.round(input.estimatedCommercialAcquisitionListings * (1 - input.estimatedOverlapPct / 100))
      );
      const rankScore = opportunityRankScore({
        ...input,
        estimatedUniqueOpportunityPotential,
      });
      return {
        ...input,
        estimatedUniqueOpportunityPotential,
        recommendation: recommendationForRank({ ...input, estimatedUniqueOpportunityPotential, rankScore }),
        rankScore,
      };
    })
    .sort((a, b) => b.rankScore - a.rankScore || a.source.localeCompare(b.source));
}

function opportunityRankScore(row: SourceOpportunityAuditInput & { estimatedUniqueOpportunityPotential: number }) {
  const difficultyPenalty = row.engineeringDifficulty === "High" ? 28 : row.engineeringDifficulty === "Medium" ? 12 : 0;
  const blockerPenalty = {
    "no issue": 0,
    pagination: 6,
    "missing pricing": 12,
    "parser issue": 4,
    "anti-bot": 55,
    "403": 70,
  } satisfies Record<SourceBlockingReason, number>;
  return Math.max(0, row.estimatedUniqueOpportunityPotential * 2 - difficultyPenalty - blockerPenalty[row.currentBlockingReason]);
}

function recommendationForRank(row: SourceOpportunityAuditInput & { estimatedUniqueOpportunityPotential: number; rankScore: number }): SourceRecommendation {
  if (row.currentBlockingReason === "403") return "Not worth pursuing yet";
  if (row.currentBlockingReason === "anti-bot") return row.rankScore >= 10 ? "Build later" : "Not worth pursuing yet";
  if (row.rankScore >= 18 && row.estimatedUniqueOpportunityPotential >= 10) return "Build immediately";
  if (row.rankScore >= 4 && row.estimatedUniqueOpportunityPotential >= 4) return "Build later";
  return "Not worth pursuing yet";
}
