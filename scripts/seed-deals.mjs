import { createClient } from "@supabase/supabase-js";
import { DEALS } from "../src/lib/deals.ts";
import { mapDealToInsert } from "../src/lib/supabase/mappers.ts";

const url = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error } = await supabase.from("deals").upsert(DEALS.map(mapDealToInsert));

if (error) {
  console.error(error);
  process.exit(1);
}

console.log(`Seeded ${DEALS.length} deals.`);
