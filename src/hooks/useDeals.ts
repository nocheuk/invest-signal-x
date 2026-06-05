import { useQuery } from "@tanstack/react-query";
import { DEALS, type Deal } from "@/lib/deals";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase/client";
import { mapDealRow, type DealSourceMetadata } from "@/lib/supabase/mappers";

export const dealsQueryKey = ["deals"];

export function useDeals() {
  return useQuery({
    queryKey: dealsQueryKey,
    queryFn: async (): Promise<Deal[]> => {
      if (!isSupabaseConfigured) return DEALS;
      const { data, error } = await requireSupabase()
        .from("deals")
        .select("*")
        .order("posted_at", { ascending: false });
      if (error) throw error;
      const metadata = await loadDealSourceMetadata((data ?? []).map((row) => row.id));
      return (data ?? []).map((row) => mapDealRow(row, metadata.get(row.id)));
    },
    initialData: isSupabaseConfigured ? undefined : DEALS,
  });
}

export function useDeal(id?: string) {
  const query = useDeals();
  return {
    ...query,
    deal: query.data?.find((deal) => deal.id === id),
  };
}

const SOURCE_METADATA_CHUNK_SIZE = 150;

async function loadDealSourceMetadata(dealIds: string[]) {
  const metadata = new Map<string, DealSourceMetadata>();
  if (dealIds.length === 0) return metadata;

  const supabase = requireSupabase();
  for (let index = 0; index < dealIds.length; index += SOURCE_METADATA_CHUNK_SIZE) {
    const chunk = dealIds.slice(index, index + SOURCE_METADATA_CHUNK_SIZE);
    const result = await withMetadataTimeout(
      supabase
        .from("deal_source_links")
        .select("deal_id,source_url,import_sources(name,source_type),raw_imports(normalized_payload)")
        .in("deal_id", chunk),
      6000
    );
    if (!result) continue;
    const { data, error } = result;

    if (error) {
      console.warn("Could not load deal source metadata", error.message);
      continue;
    }

    for (const link of data ?? []) {
      if (!link.deal_id || metadata.has(link.deal_id)) continue;
      const importSource = Array.isArray(link.import_sources) ? link.import_sources[0] : link.import_sources;
      const rawImport = Array.isArray(link.raw_imports) ? link.raw_imports[0] : link.raw_imports;
      metadata.set(link.deal_id, {
        sourceUrl: link.source_url,
        importSourceName: importSource?.name,
        importSourceType: importSource?.source_type,
        imageUrl: extractImageUrl(rawImport?.normalized_payload),
      });
    }
  }

  return metadata;
}

async function withMetadataTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.warn("Timed out loading deal source metadata");
      resolve(null);
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function extractImageUrl(value: unknown): string | undefined {
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = extractImageUrl(item);
      if (url) return url;
    }
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["imageUrl", "image_url", "image", "photo", "photoUrl", "photo_url", "thumbnail", "thumbnailUrl", "thumbnail_url", "images", "photos", "propertyImages", "propertyImage"]) {
      const url = extractImageUrl(record[key]);
      if (url) return url;
    }
  }
  return undefined;
}
