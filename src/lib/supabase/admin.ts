import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client mit Secret Key – umgeht RLS. Nur für Hintergrund-Jobs (Sync, Cron)
 * und das Lesen der verschlüsselten Zugangsdaten verwenden.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
