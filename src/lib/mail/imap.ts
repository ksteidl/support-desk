import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import type { MailboxWithPassword } from "./credentials";

export interface FetchedMail {
  uid: number;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  fromEmail: string;
  fromName: string | null;
  to: string[];
  subject: string;
  text: string;
  html: string | null;
  date: Date;
  isAutomated: boolean;
}

const FIRST_SYNC_DAYS = 14;
const MAX_PER_RUN = 150;

function connect(mb: MailboxWithPassword) {
  return new ImapFlow({
    host: mb.imap_host,
    port: mb.imap_port,
    secure: mb.imap_secure,
    auth: { user: mb.username, pass: mb.password },
    logger: false,
    socketTimeout: 60_000,
  });
}

function addresses(obj: AddressObject | AddressObject[] | undefined) {
  const list = Array.isArray(obj) ? obj : obj ? [obj] : [];
  return list.flatMap((a) => a.value);
}

function toRefs(value: string | string[] | undefined) {
  if (!value) return [];
  return (Array.isArray(value) ? value : value.split(/\s+/)).filter(Boolean);
}

function isAutomated(parsed: ParsedMail) {
  const auto = String(parsed.headers.get("auto-submitted") ?? "no").toLowerCase();
  const precedence = String(parsed.headers.get("precedence") ?? "").toLowerCase();
  const from = addresses(parsed.from)[0]?.address?.toLowerCase() ?? "";
  return (
    auto !== "no" ||
    ["bulk", "junk", "list"].includes(precedence) ||
    /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply)@/.test(from)
  );
}

export async function testImap(mb: MailboxWithPassword) {
  const client = connect(mb);
  await client.connect();
  const status = await client.status("INBOX", { messages: true });
  await client.logout();
  return status ? (status.messages ?? 0) : 0;
}

/** Holt neue Nachrichten seit `last_uid` aus dem Posteingang. */
export async function fetchNewMail(mb: MailboxWithPassword) {
  const client = connect(mb);
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  const mails: FetchedMail[] = [];
  let uidValidity = mb.uid_validity;
  let lastUid = mb.last_uid;

  try {
    const box = client.mailbox;
    const currentValidity = box ? Number(box.uidValidity) : null;
    if (currentValidity !== uidValidity) {
      // Neues oder zurückgesetztes Postfach: von vorne beginnen (Duplikate verhindert der Unique-Index).
      uidValidity = currentValidity;
      lastUid = 0;
    }

    let uids: number[];
    if (lastUid === 0) {
      const since = new Date(Date.now() - FIRST_SYNC_DAYS * 86_400_000);
      uids = (await client.search({ since }, { uid: true })) || [];
    } else {
      uids = (await client.search({ uid: `${lastUid + 1}:*` }, { uid: true })) || [];
    }
    uids = uids.filter((u) => u > lastUid).sort((a, b) => a - b).slice(0, MAX_PER_RUN);

    if (uids.length) {
      for await (const msg of client.fetch(uids, { uid: true, source: true }, { uid: true })) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        const from = addresses(parsed.from)[0];
        mails.push({
          uid: msg.uid,
          messageId: parsed.messageId ?? null,
          inReplyTo: parsed.inReplyTo ?? null,
          references: toRefs(parsed.references),
          fromEmail: (from?.address ?? "").toLowerCase(),
          fromName: from?.name || null,
          to: addresses(parsed.to).map((a) => (a.address ?? "").toLowerCase()).filter(Boolean),
          subject: parsed.subject ?? "",
          text: parsed.text ?? "",
          html: typeof parsed.html === "string" ? parsed.html : null,
          date: parsed.date ?? new Date(),
          isAutomated: isAutomated(parsed),
        });
        lastUid = Math.max(lastUid, msg.uid);
      }
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }

  return { mails, lastUid, uidValidity };
}

/** Legt eine gesendete Antwort im "Gesendet"-Ordner ab (best effort). */
export async function appendToSent(mb: MailboxWithPassword, raw: Buffer) {
  const client = connect(mb);
  try {
    await client.connect();
    const boxes = await client.list();
    const sent = boxes.find((b) => b.specialUse === "\\Sent");
    if (sent) await client.append(sent.path, raw, ["\\Seen"]);
  } catch {
    // Nicht kritisch – die Antwort ist bereits verschickt und in der App gespeichert.
  } finally {
    await client.logout().catch(() => {});
  }
}
