import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dealsQueryKey } from "@/hooks/useDeals";
import { useAuth } from "@/lib/auth";

export type LocationImportResult = {
  locationQuery: string;
  sourceName: string;
  dryRun: boolean;
  reusedRecentSearch?: boolean;
  code?: string;
  total: number;
  unique: number;
  imported: number;
  existing: number;
  failed: number;
  skippedDuplicate: number;
  processed: number;
};

export class LocationImportError extends Error {
  code?: string;
  detail?: string;

  constructor(message: string, { code, detail }: { code?: string; detail?: string } = {}) {
    super(message);
    this.name = "LocationImportError";
    this.code = code;
    this.detail = detail;
  }
}

export function useLocationImport() {
  const auth = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ locationQuery, dryRun = false }: { locationQuery: string; dryRun?: boolean }) => {
      const response = await fetch("/api/location-search", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(auth.session?.access_token ? { authorization: `Bearer ${auth.session.access_token}` } : {}),
        },
        body: JSON.stringify({ locationQuery, dryRun }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new LocationImportError(
          body.error || "Couldn't search this location yet. Try a Rightmove search URL instead.",
          { code: body.code, detail: body.detail }
        );
      }
      return body as LocationImportResult;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dealsQueryKey });
    },
  });
}
