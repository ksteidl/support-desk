import { format, isThisYear, isToday, isYesterday, formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";

export function shortDate(value: string | Date) {
  const d = new Date(value);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Gestern";
  return format(d, isThisYear(d) ? "d. MMM" : "dd.MM.yy", { locale: de });
}

export function longDate(value: string | Date) {
  return format(new Date(value), "EEE, d. MMM yyyy · HH:mm", { locale: de });
}

export function relative(value: string | Date) {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true, locale: de });
}

export function initials(name: string | null | undefined, email: string) {
  const src = (name || email.split("@")[0]).replace(/[^\p{L}\s]/gu, " ").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function money(amount: string, currency: string) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(Number(amount));
}
