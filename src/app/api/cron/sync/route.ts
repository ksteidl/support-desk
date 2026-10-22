import { after, NextResponse, type NextRequest } from "next/server";
import { generateForTickets, syncAll } from "@/lib/mail/sync";
import { aiEnabled, generateDraft } from "@/lib/ai";

export const maxDuration = 300;

/** Für Vercel Cron o. ä.: Authorization: Bearer $CRON_SECRET */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await syncAll();
  const ticketIds = results.flatMap((r) => r.ticketIds);
  // KI-Entwürfe nach der Antwort im Hintergrund erzeugen
  if (aiEnabled() && ticketIds.length) after(() => generateForTickets(ticketIds, (id) => generateDraft(id)));
  return NextResponse.json({ mailboxes: results.length, imported: results.reduce((n, r) => n + r.imported, 0) });
}
