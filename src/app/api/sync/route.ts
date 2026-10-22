import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateForTickets, syncAll } from "@/lib/mail/sync";
import { aiEnabled, generateDraft } from "@/lib/ai";

export const maxDuration = 300;

/** Manueller / periodischer Sync aus der App für den eingeloggten Benutzer. */
export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results = await syncAll({ userId });
  const ticketIds = results.flatMap((r) => r.ticketIds);
  // KI-Entwürfe nach der Antwort im Hintergrund erzeugen
  if (aiEnabled() && ticketIds.length) after(() => generateForTickets(ticketIds, (id) => generateDraft(id)));
  return NextResponse.json({
    imported: results.reduce((n, r) => n + r.imported, 0),
    errors: results.filter((r) => r.error).map((r) => ({ email: r.email, error: r.error })),
  });
}
