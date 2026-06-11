import type { Deal } from "@/lib/deals";
import { formatGBP, formatPct } from "@/lib/deals";

export type FinanceScenarioName = "Cash purchase" | "50% LTV" | "60% LTV" | "75% LTV";

export type FinancialAssumptions = {
  interestRatePct: number;
  legalFees: number;
  surveyFees: number;
  arrangementFeePct: number;
  voidAllowancePct: number;
  managementAllowancePct: number;
};

export type AcquisitionCosts = {
  guidePrice: number;
  sdlt: number;
  legalFees: number;
  surveyFees: number;
  totalAcquisitionCost: number;
};

export type FinanceScenario = {
  name: FinanceScenarioName;
  ltv: number;
  loanAmount: number;
  deposit: number;
  arrangementFee: number;
  cashRequired: number;
  annualRent: number | null;
  annualFinanceCost: number;
  operatingAllowance: number | null;
  annualNetCashflow: number | null;
  netYield: number | null;
  cashOnCashReturn: number | null;
  missingRent: boolean;
};

export type FinancialAnalysis = {
  assumptions: FinancialAssumptions;
  acquisitionCosts: AcquisitionCosts;
  scenarios: FinanceScenario[];
};

export const DEFAULT_FINANCIAL_ASSUMPTIONS: FinancialAssumptions = {
  interestRatePct: 7,
  legalFees: 7500,
  surveyFees: 3000,
  arrangementFeePct: 1,
  voidAllowancePct: 5,
  managementAllowancePct: 5,
};

const SCENARIOS: Array<{ name: FinanceScenarioName; ltv: number }> = [
  { name: "Cash purchase", ltv: 0 },
  { name: "50% LTV", ltv: 0.5 },
  { name: "60% LTV", ltv: 0.6 },
  { name: "75% LTV", ltv: 0.75 },
];

export function calculateCommercialSdlt(price: number) {
  const guidePrice = safeMoney(price);
  if (guidePrice <= 150000) return 0;
  const bandTwo = Math.max(0, Math.min(guidePrice, 250000) - 150000) * 0.02;
  const bandThree = Math.max(0, guidePrice - 250000) * 0.05;
  return Math.round(bandTwo + bandThree);
}

export function buildFinancialAnalysis(deal: Deal, assumptions: FinancialAssumptions = DEFAULT_FINANCIAL_ASSUMPTIONS): FinancialAnalysis {
  const cleanAssumptions = sanitizeAssumptions(assumptions);
  const guidePrice = safeMoney(deal.guidePrice);
  const sdlt = calculateCommercialSdlt(guidePrice);
  const acquisitionCosts: AcquisitionCosts = {
    guidePrice,
    sdlt,
    legalFees: cleanAssumptions.legalFees,
    surveyFees: cleanAssumptions.surveyFees,
    totalAcquisitionCost: guidePrice + sdlt + cleanAssumptions.legalFees + cleanAssumptions.surveyFees,
  };
  const annualRent = safeMoney(deal.passingRent) || null;
  const operatingAllowance = annualRent === null
    ? null
    : annualRent * ((cleanAssumptions.voidAllowancePct + cleanAssumptions.managementAllowancePct) / 100);
  const netOperatingIncome = annualRent === null ? null : annualRent - (operatingAllowance ?? 0);

  return {
    assumptions: cleanAssumptions,
    acquisitionCosts,
    scenarios: SCENARIOS.map(({ name, ltv }) => {
      const loanAmount = Math.round(guidePrice * ltv);
      const deposit = guidePrice - loanAmount;
      const arrangementFee = Math.round(loanAmount * (cleanAssumptions.arrangementFeePct / 100));
      const annualFinanceCost = Math.round(loanAmount * (cleanAssumptions.interestRatePct / 100));
      const cashRequired = deposit + sdlt + cleanAssumptions.legalFees + cleanAssumptions.surveyFees + arrangementFee;
      const annualNetCashflow = netOperatingIncome === null ? null : Math.round(netOperatingIncome - annualFinanceCost);
      return {
        name,
        ltv,
        loanAmount,
        deposit,
        arrangementFee,
        cashRequired,
        annualRent,
        annualFinanceCost,
        operatingAllowance: operatingAllowance === null ? null : Math.round(operatingAllowance),
        annualNetCashflow,
        netYield: netOperatingIncome === null || acquisitionCosts.totalAcquisitionCost <= 0 ? null : (netOperatingIncome / acquisitionCosts.totalAcquisitionCost) * 100,
        cashOnCashReturn: annualNetCashflow === null || cashRequired <= 0 ? null : (annualNetCashflow / cashRequired) * 100,
        missingRent: annualRent === null,
      };
    }),
  };
}

export function formatFinancialPercent(value: number | null, digits = 1) {
  return value === null ? "Not available" : formatPct(value, digits);
}

export function formatFinancialMoney(value: number | null) {
  return value === null ? "Not available" : formatGBP(value);
}

function sanitizeAssumptions(assumptions: FinancialAssumptions): FinancialAssumptions {
  return {
    interestRatePct: clampNumber(assumptions.interestRatePct, 0, 25),
    legalFees: safeMoney(assumptions.legalFees),
    surveyFees: safeMoney(assumptions.surveyFees),
    arrangementFeePct: clampNumber(assumptions.arrangementFeePct, 0, 10),
    voidAllowancePct: clampNumber(assumptions.voidAllowancePct, 0, 50),
    managementAllowancePct: clampNumber(assumptions.managementAllowancePct, 0, 50),
  };
}

function safeMoney(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function clampNumber(value: number, min: number, max: number) {
  const number = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, number));
}
