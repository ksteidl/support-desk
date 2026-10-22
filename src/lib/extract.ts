import type { ExtractedEntities } from "./types";

const ORDER_KEYWORD =
  /(?:bestell(?:ung|nummer|nr\.?)|auftrag(?:snummer|snr\.?)?|rechnungs?(?:nummer|nr\.?)|order(?:\s*(?:number|no\.?|nr\.?|id|#))?|commande|ordine|pedido)\s*[:#.]?\s*(?:nr\.?|no\.?)?\s*#?\s*([A-Z]{0,6}-?\d{3,10})\b/gi;
const ORDER_HASH = /(?:^|[\s(\[:,])#\s?([A-Z]{0,6}-?\d{3,10})\b/gi;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+|00)\d{1,3}[\s/-]?\(?\d{2,5}\)?[\s/-]?\d{3,}[\s/-]?\d{0,6}/g;
const TRACKING = /\b(JJD\d{10,22}|00\d{18}|1Z[0-9A-Z]{16}|[A-Z]{2}\d{9}[A-Z]{2}|\d{12,14})\b/g;
const TRACKING_EXACT = /^(JJD\d{10,22}|00\d{18}|1Z[0-9A-Z]{16}|[A-Z]{2}\d{9}[A-Z]{2})$/;
const NAME_SIGNOFF =
  /(?:viele grüße|liebe grüße|lg|mit freundlichen grüßen|mfg|beste grüße|gruß|grüße|best regards|kind regards|regards|thanks|danke|cheers|best)[,!.]?\s*\n+\s*([A-ZÄÖÜ][a-zäöüß]+(?:[ -][A-ZÄÖÜ][a-zäöüß]+){0,2})\s*$/im;

function uniq(values: string[]) {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

/** Entfernt zitierte Antworten ("> ..." / "Am ... schrieb ...") aus einem Mail-Text. */
export function stripQuoted(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (
      /^(am|on)\s.+(schrieb|wrote)\s?.*:$/i.test(t) ||
      /^-{2,}\s*(original message|ursprüngliche nachricht|weitergeleitete nachricht|forwarded message)/i.test(t) ||
      /^(von|from):\s.+/i.test(t) && out.length > 2
    ) {
      break;
    }
    if (t.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function normalizeOrderNumber(value: string) {
  return value.replace(/\s/g, "").replace(/^#/, "").toUpperCase();
}

function findOrderNumbers(text: string) {
  const found: string[] = [];
  for (const re of [ORDER_KEYWORD, ORDER_HASH]) {
    for (const m of text.matchAll(re)) found.push(normalizeOrderNumber(m[1]));
  }
  return found;
}

export function extractEntities(fullText: string, fromName?: string | null): ExtractedEntities {
  // Zuerst nur die neue Nachricht scannen; zitierten Verlauf nur als Fallback nutzen.
  const fresh = stripQuoted(fullText);
  const text = fresh.length > 0 ? fresh : fullText;
  let orderNumbers = findOrderNumbers(text);
  if (orderNumbers.length === 0) orderNumbers = findOrderNumbers(fullText);

  const names: string[] = [];
  if (fromName && !fromName.includes("@")) names.push(fromName.replace(/["']/g, ""));
  const signoff = text.match(NAME_SIGNOFF);
  if (signoff) names.push(signoff[1]);

  return {
    orderNumbers: uniq(orderNumbers).slice(0, 5),
    emails: uniq((text.match(EMAIL) ?? []).map((e) => e.toLowerCase())).slice(0, 5),
    names: uniq(names),
    phones: uniq(text.match(PHONE) ?? []).filter((p) => !TRACKING_EXACT.test(p.replace(/\s/g, ""))).slice(0, 3),
    trackingNumbers: uniq(text.match(TRACKING) ?? []).filter((t) => !orderNumbers.includes(t)).slice(0, 3),
  };
}

export function mergeEntities(list: ExtractedEntities[]): ExtractedEntities {
  return {
    orderNumbers: uniq(list.flatMap((e) => e.orderNumbers)),
    emails: uniq(list.flatMap((e) => e.emails)),
    names: uniq(list.flatMap((e) => e.names)),
    phones: uniq(list.flatMap((e) => e.phones)),
    trackingNumbers: uniq(list.flatMap((e) => e.trackingNumbers)),
  };
}
