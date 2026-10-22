"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDraft } from "@/lib/ai";
import { getMailboxPassword } from "@/lib/mail/credentials";
import { sendMail } from "@/lib/mail/smtp";
import { appendToSent } from "@/lib/mail/imap";
import type { Mailbox, Message, Ticket, TicketStatus } from "@/lib/types";
import type { ActionResult } from "./stores";

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Lädt das Ticket mit den Rechten des eingeloggten Benutzers (RLS = Besitzprüfung). */
async function ownTicket(ticketId: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("tickets").select("*").eq("id", ticketId).single<Ticket>();
  if (!data) throw new Error("Ticket nicht gefunden");
  return { supabase, ticket: data };
}

export async function setTicketStatus(ticketId: string, status: TicketStatus): Promise<ActionResult> {
  const { supabase } = await ownTicket(ticketId);
  const { error } = await supabase.from("tickets").update({ status, unread: false }).eq("id", ticketId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/inbox/${ticketId}`);
  return { ok: true };
}

export async function markRead(ticketId: string) {
  const { supabase } = await requireUser();
  await supabase.from("tickets").update({ unread: false }).eq("id", ticketId);
}

export async function saveDraft(ticketId: string, body: string) {
  const { supabase, ticket } = await ownTicket(ticketId);
  await supabase.from("drafts").upsert({ ticket_id: ticketId, user_id: ticket.user_id, body });
  await supabase.from("tickets").update({ has_draft: body.trim().length > 0 }).eq("id", ticketId);
}

export async function regenerateDraft(
  ticketId: string,
  instruction?: string,
  currentDraft?: string,
): Promise<ActionResult & { body?: string; needsAttention?: boolean; reason?: string }> {
  try {
    await ownTicket(ticketId);
    const out = await generateDraft(ticketId, { instruction: instruction?.trim() || undefined, currentDraft });
    revalidatePath(`/inbox/${ticketId}`);
    return { ok: true, body: out.reply, needsAttention: out.needs_attention, reason: out.attention_reason };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

export async function sendReply(ticketId: string, body: string, closeAfter: boolean): Promise<ActionResult> {
  if (!body.trim()) return { ok: false, error: "Die Antwort ist leer" };
  try {
    const { supabase, ticket } = await ownTicket(ticketId);
    const [{ data: mailbox }, { data: thread }] = await Promise.all([
      supabase.from("mailboxes").select("*").eq("id", ticket.mailbox_id).single<Mailbox>(),
      supabase.from("messages").select("*").eq("ticket_id", ticketId).order("sent_at").returns<Message[]>(),
    ]);
    if (!mailbox) throw new Error("Postfach nicht gefunden");

    const lastInbound = [...(thread ?? [])].reverse().find((m) => m.direction === "inbound");
    const references = [
      ...new Set([...(lastInbound?.reference_ids ?? []), ...(thread ?? []).map((m) => m.message_id).filter((x): x is string => !!x)]),
    ].slice(-20);
    const subject = /^(re|aw):/i.test(ticket.subject) ? ticket.subject : `Re: ${ticket.subject}`;

    const mb = { ...mailbox, password: await getMailboxPassword(mailbox.id) };
    const sent = await sendMail(mb, {
      to: ticket.customer_email,
      subject,
      text: body,
      inReplyTo: lastInbound?.message_id,
      references,
    });
    void appendToSent(mb, sent.raw);

    const now = new Date().toISOString();
    const admin = createAdminClient();
    await Promise.all([
      admin.from("messages").insert({
        user_id: ticket.user_id,
        ticket_id: ticketId,
        mailbox_id: mailbox.id,
        direction: "outbound",
        message_id: sent.messageId,
        in_reply_to: lastInbound?.message_id ?? null,
        reference_ids: references,
        from_email: mailbox.email,
        from_name: mailbox.display_name || null,
        to_emails: [ticket.customer_email],
        subject,
        body_text: body,
        sent_at: now,
      }),
      admin.from("drafts").delete().eq("ticket_id", ticketId),
      admin
        .from("tickets")
        .update({ status: closeAfter ? "closed" : "waiting", has_draft: false, unread: false, last_message_at: now })
        .eq("id", ticketId),
    ]);
    revalidatePath(`/inbox/${ticketId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Senden fehlgeschlagen: ${message(err)}` };
  }
}
