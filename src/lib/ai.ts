import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractEntities, mergeEntities, stripQuoted } from "@/lib/extract";
import { getShopifyToken } from "@/lib/mail/credentials";
import { lookupShopifyContext } from "@/lib/shopify";
import type { Message, ShopifyContext, Store, Ticket } from "@/lib/types";

export const AI_MODEL = "claude-opus-5-5";

const DraftSchema = z.object({
  reply: z.string().describe("Fertige E-Mail-Antwort an den Kunden, Klartext, inkl. Anrede und Signatur"),
  summary: z.string().describe("Ein Satz für das Support-Team: Worum geht es, was ist zu tun?"),
  category: z.enum([
    "shipping",
    "return",
    "refund",
    "exchange",
    "product",
    "order_change",
    "payment",
    "complaint",
    "other",
  ]),
  needs_attention: z
    .boolean()
    .describe("true, wenn ein Mensch vor dem Senden etwas prüfen/entscheiden muss (z. B. Erstattung, fehlende Daten)"),
  attention_reason: z.string().describe("Kurze Begründung, falls needs_attention true ist, sonst leer"),
});

let client: Anthropic | null = null;
function anthropic() {
  client ??= new Anthropic();
  return client;
}

const LANG: Record<string, string> = { de: "Deutsch", en: "Englisch", fr: "Französisch", it: "Italienisch", es: "Spanisch", nl: "Niederländisch" };

function systemPrompt(store: Store) {
  return `Du bist ein erfahrener Kundensupport-Mitarbeiter des Online-Shops "${store.name}" (${store.shop_domain}).
Du schreibst Antworten auf Kunden-E-Mails, die ein Mitarbeiter vor dem Versand prüft.

Wie du arbeitest:
- Nutze die Shopify-Daten (Bestellungen, Status, Sendungsverfolgung), um die Frage konkret zu beantworten. Nenne Bestellnummer, Status und Tracking-Link, wenn sie relevant sind.
- Erfinde keine Fakten. Was nicht in den Daten oder im Verlauf steht (z. B. Lieferdatum ohne Tracking, Lagerbestand, Rückerstattungszusagen), versprichst du nicht. Fehlt etwas Wichtiges, z. B. eine Bestellnummer, bitte den Kunden freundlich darum.
- Entscheidungen mit Geld- oder Kulanzfolgen (Erstattung, Gutschein, Ersatz) formulierst du nur, wenn die Shop-Richtlinien sie abdecken; sonst setzt du needs_attention und formulierst neutral ("wir prüfen das und melden uns").
- Antworte in der Sprache des Kunden. Wenn unklar: ${LANG[store.language] ?? store.language}.
- Ton: freundlich, menschlich, auf den Punkt. Kurze Absätze, kein Markdown, keine Aufzählungszeichen-Orgien, keine Betreffzeile.
- Beende die Mail mit der Signatur des Shops${store.signature ? "" : " (Vorname des Teams + Shopname)"}.

Tonalität und Richtlinien des Shops:
${store.brand_voice || "(keine besonderen Vorgaben)"}

Signatur:
${store.signature || `Dein Team von ${store.name}`}`;
}

function formatOrders(ctx: ShopifyContext | null) {
  if (!ctx) return "Kein Shopify-Zugriff konfiguriert.";
  if (ctx.error) return `Shopify-Abfrage fehlgeschlagen: ${ctx.error}`;
  const parts: string[] = [];
  if (ctx.customer) {
    const c = ctx.customer;
    parts.push(
      `Kunde: ${c.name} <${c.email ?? "?"}>, ${c.numberOfOrders} Bestellungen, Umsatz ${c.amountSpent ?? "?"}${c.tags.length ? `, Tags: ${c.tags.join(", ")}` : ""}${c.note ? `, Notiz: ${c.note}` : ""}`,
    );
  } else {
    parts.push("Kein Kundenkonto zur Absender-Adresse gefunden.");
  }
  if (!ctx.orders.length) parts.push("Keine passenden Bestellungen gefunden.");
  for (const o of ctx.orders.slice(0, 6)) {
    parts.push(
      [
        `Bestellung ${o.name} vom ${o.createdAt.slice(0, 10)} – ${o.total} ${o.currency}`,
        `  Zahlung: ${o.financialStatus ?? "?"}, Versand: ${o.fulfillmentStatus ?? "?"}${o.cancelledAt ? `, STORNIERT am ${o.cancelledAt.slice(0, 10)}` : ""}`,
        `  Artikel: ${o.items.map((i) => `${i.quantity}× ${i.title}${i.variant ? ` (${i.variant})` : ""}`).join("; ")}`,
        o.tracking.length
          ? `  Tracking: ${o.tracking.map((t) => [t.company, t.number, t.url].filter(Boolean).join(" ")).join(" | ")}`
          : "  Tracking: noch keine Sendungsnummer",
        o.shippingAddress ? `  Lieferadresse: ${o.shippingAddress}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return parts.join("\n\n");
}

function formatThread(messages: Message[]) {
  return messages
    .map((m) => {
      const who = m.direction === "inbound" ? `KUNDE (${m.from_name ?? m.from_email})` : "WIR (Support)";
      const body = stripQuoted(m.body_text).slice(0, 6000);
      return `--- ${who} · ${new Date(m.sent_at).toLocaleString("de-DE")} ---\nBetreff: ${m.subject}\n\n${body}`;
    })
    .join("\n\n");
}

/** Scannt das Ticket, holt Shopify-Daten und speichert einen neuen KI-Entwurf. */
export async function generateDraft(ticketId: string, opts: { instruction?: string; currentDraft?: string } = {}) {
  const db = createAdminClient();
  const { data: ticket } = await db.from("tickets").select("*").eq("id", ticketId).single<Ticket>();
  if (!ticket) throw new Error("Ticket nicht gefunden");

  const [{ data: store }, { data: messages }, { data: history }] = await Promise.all([
    db.from("stores").select("*").eq("id", ticket.store_id).single<Store>(),
    db.from("messages").select("*").eq("ticket_id", ticketId).order("sent_at").returns<Message[]>(),
    db
      .from("tickets")
      .select("subject, summary, status, last_message_at")
      .eq("user_id", ticket.user_id)
      .eq("customer_email", ticket.customer_email)
      .neq("id", ticketId)
      .order("last_message_at", { ascending: false })
      .limit(5),
  ]);
  if (!store || !messages?.length) throw new Error("Daten unvollständig");

  // 1) Scan: Bestellnummern, E-Mails, Namen, Tracking-Nummern
  const extracted = mergeEntities(
    messages.filter((m) => m.direction === "inbound").map((m) => extractEntities(`${m.subject}\n${m.body_text}`, m.from_name)),
  );

  // 2) Shopify-Lookup
  const token = await getShopifyToken(store.id);
  const shopify = token
    ? await lookupShopifyContext({ shop: store.shop_domain, token, customerEmail: ticket.customer_email, extracted })
    : null;

  // 3) Claude
  const userContent = `<shopify_daten>
${formatOrders(shopify)}
</shopify_daten>

<gescannte_daten>
Bestellnummern: ${extracted.orderNumbers.join(", ") || "–"}
E-Mails: ${extracted.emails.join(", ") || "–"}
Namen: ${extracted.names.join(", ") || "–"}
Tracking-Nummern: ${extracted.trackingNumbers.join(", ") || "–"}
</gescannte_daten>

<fruehere_anfragen_dieses_kunden>
${history?.length ? history.map((h) => `- ${h.last_message_at.slice(0, 10)} "${h.subject}" (${h.status}): ${h.summary ?? ""}`).join("\n") : "Keine"}
</fruehere_anfragen_dieses_kunden>

<email_verlauf>
${formatThread(messages)}
</email_verlauf>
${
  opts.instruction
    ? `\n<bisheriger_entwurf>\n${opts.currentDraft ?? ""}\n</bisheriger_entwurf>\n\nÜberarbeite den Entwurf nach dieser Anweisung des Mitarbeiters: ${opts.instruction}`
    : "\nSchreibe die Antwort auf die letzte Kundennachricht."
}`;

  const response = await anthropic().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(DraftSchema) },
    system: systemPrompt(store),
    messages: [{ role: "user", content: userContent }],
  });

  if (response.stop_reason === "refusal") throw new Error("Die KI hat diese Anfrage abgelehnt.");
  const out = response.parsed_output;
  if (!out) throw new Error("KI-Antwort konnte nicht gelesen werden");

  await Promise.all([
    db.from("drafts").upsert({
      ticket_id: ticketId,
      user_id: ticket.user_id,
      body: out.reply.trim(),
      model: response.model,
      reasoning: out.needs_attention ? out.attention_reason : null,
      needs_attention: out.needs_attention,
      generated_at: new Date().toISOString(),
    }),
    db
      .from("tickets")
      .update({
        has_draft: true,
        category: out.category,
        summary: out.summary,
        order_numbers: extracted.orderNumbers,
        shopify_context: shopify,
        customer_name: ticket.customer_name ?? extracted.names[0] ?? shopify?.customer?.name ?? null,
      })
      .eq("id", ticketId),
  ]);

  return out;
}

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
