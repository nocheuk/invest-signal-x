import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { ReactNode } from "react";

const GLOSSARY: Record<string, string> = {
  "WAULT": "Weighted Average Unexpired Lease Term — average remaining lease length weighted by rent. Higher = more secure income.",
  "NIY": "Net Initial Yield — net income (after purchaser's costs) divided by gross purchase price. The investor's true day-one return.",
  "Gross yield": "Annual passing rent divided by purchase price, before purchaser's costs.",
  "Reversionary yield": "What the yield would be if the property were re-let at full estimated rental value (ERV).",
  "Exit yield sensitivity": "How much the exit value moves if cap rates shift 25 bps. High sensitivity = thin margin of safety.",
  "Covenant strength": "Financial standing of the tenant. Strong = institutional/listed; Weak = SME or distressed.",
  "Rent sustainability": "Whether the passing rent is in line with the open market — under-, at, or over-rented.",
  "Planning upside": "Score reflecting alternative-use potential (e.g. PDR to residential, redevelopment).",
  "Void risk": "Probability-weighted estimate of vacancy in the next 24 months.",
  "DealSignal Score": "Weighted underwriting score combining income quality, tenant security, market pricing, upside, and risk.",
  "Cashflow after debt": "Annual cashflow after typical 60% LTV financing at prevailing rates.",
  "Return on equity": "Annual cash return on investor equity, after debt service.",
  "Rent review": "Mechanism for adjusting rent — upward-only, fixed uplift, CPI-linked, or open market.",
};

export function Hint({ term, children }: { term: keyof typeof GLOSSARY | string; children?: ReactNode }) {
  const text = GLOSSARY[term] || "";
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help">
            {children ?? term}
            <Info className="h-3 w-3 text-muted-foreground/60" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
