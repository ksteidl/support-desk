import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripQuoted } from "@/lib/extract";
import type { Mailbox } from "@/lib/types";
import { getMailboxPassword } from "./credentials";
import { fetchNewMail, type FetchedMail } from "./imap";

type MailboxRow = Mailbox & { user_id: string };

export function normalizeSubject(subject: string) {
  return subject.replace(/^\s*((re|aw|wg|fwd?|antw)\s*(\[\d+\])?\s*:\s*)+/i, "").trim().toLowerCase();
}

function snippetOf(text: string) {
  return stripQuoted(text).replace(/\s+/g, " ").slice(0, 180);
}

/** Findet das passende Ticket (Thread) für eine eingehende Mail oder legt ein neues an. */
async function resolveTicket(db: SupabaseClient, mb: MailboxRow, mail: FetchedMail) {
  const refs = [mail.inReplyTo, ...mail.references].filter((r): r is string => Boolean(r));
  if (refs.length) {
    const { data } = await db
      .from("messages")
      .select("ticket_id")
      .eq("mailbox_id", mb.id)
      .in("message_id", refs)
      .limit(1);
    if (data?.[0]) return { id: data[0].ticket_id as string, isNew: false };
  }

  // Fallback: gleicher Kunde + gleicher Betreff in den letzten 30 Tagen
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: candidates } = await db
    .from("tickets")
    .select("id, subject")
    .eq("mailbox_id", mb.id)
    .eq("customer_email", mail.fromEmail)
    .gte("last_message_at", since)
    .order("last_message_at", { ascending: false })
    .limit(10);
  const subj = normalizeSubject(mail.subject);
  const match = candidates?.find((c) => normalizeSubject(c.subject) === subj);
  if (match) return { id: match.id as string, isNew: false };

  const { data: created, error } = await db
    .from("tickets")
    .insert({
      user_id: mb.user_id,
      store_id: mb.store_id,
      mailbox_id: mb.id,
      customer_email: mail.fromEmail,
      customer_name: mail.fromName,
      subject: mail.subject || "(kein Betreff)",
      snippet: snippetOf(mail.text),
      last_message_at: mail.date.toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: created.id as string, isNew: true };
}

export interface SyncResult {
  mailboxId: string;
  email: string;
  imported: number;
  ticketIds: string[];
  error?: string;
}

export async function syncMailbox(mb: MailboxRow): Promise<SyncResult> {
  const db = createAdminClient();
  const result: SyncResult = { mailboxId: mb.id, email: mb.email, imported: 0, ticketIds: [] };

  try {
    const password = await getMailboxPassword(mb.id);
    const { mails, lastUid, uidValidity } = await fetchNewMail({ ...mb, password });
    const touched = new Set<string>();

    for (const mail of mails) {
      if (!mail.fromEmail || mail.fromEmail === mb.email.toLowerCase() || mail.isAutomated) continue;
      if (mail.messageId) {
        const { data: dup } = await db
          .from("messages")
          .select("id")
          .eq("mailbox_id", mb.id)
          .eq("message_id", mail.messageId)
          .maybeSingle();
        if (dup) continue;
      }

      const ticket = await resolveTicket(db, mb, mail);
      const { error } = await db.from("messages").insert({
        user_id: mb.user_id,
        ticket_id: ticket.id,
        mailbox_id: mb.id,
        direction: "inbound",
        message_id: mail.messageId,
        in_reply_to: mail.inReplyTo,
        reference_ids: mail.references,
        from_email: mail.fromEmail,
        from_name: mail.fromName,
        to_emails: mail.to,
        subject: mail.subject,
        body_text: mail.text,
        body_html: mail.html,
        sent_at: mail.date.toISOString(),
      });
      if (error?.code === "23505") continue; // parallel bereits importiert
      if (error) throw error;

      if (!ticket.isNew) {
        await db
          .from("tickets")
          .update({
            status: "open",
            unread: true,
            snippet: snippetOf(mail.text),
            last_message_at: mail.date.toISOString(),
            ...(mail.fromName ? { customer_name: mail.fromName } : {}),
          })
          .eq("id", ticket.id);
      }
      touched.add(ticket.id);
      result.imported++;
    }

    await db
      .from("mailboxes")
      .update({ last_uid: lastUid, uid_validity: uidValidity, last_synced_at: new Date().toISOString(), last_error: null })
      .eq("id", mb.id);
    result.ticketIds = [...touched];
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    await db.from("mailboxes").update({ last_error: result.error, last_synced_at: new Date().toISOString() }).eq("id", mb.id);
  }
  return result;
}

/** Synchronisiert alle Postfächer (optional nur die eines Benutzers). */
export async function syncAll(opts: { userId?: string } = {}) {
  const db = createAdminClient();
  let query = db.from("mailboxes").select("*");
  if (opts.userId) query = query.eq("user_id", opts.userId);
  const { data: mailboxes, error } = await query;
  if (error) throw error;

  return Promise.all((mailboxes as MailboxRow[]).map(syncMailbox));
}

/** Erzeugt Entwürfe mit begrenzter Parallelität, um Rate Limits zu schonen. */
export async function generateForTickets(ids: string[], generate: (ticketId: string) => Promise<unknown>) {
  for (let i = 0; i < ids.length; i += 3) {
    const results = await Promise.allSettled(ids.slice(i, i + 3).map(generate));
    results.forEach((r) => r.status === "rejected" && console.error("Entwurf fehlgeschlagen:", r.reason));
  }
}
