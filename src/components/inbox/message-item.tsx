"use client";

import { useMemo, useState } from "react";
import { stripQuoted } from "@/lib/extract";
import { initials, longDate } from "@/lib/format";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

function htmlToText(html: string) {
  if (typeof window === "undefined") return html.replace(/<[^>]+>/g, " ");
  const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n"), "text/html");
  return doc.body.textContent ?? "";
}

export function MessageItem({ message, collapsed: initiallyCollapsed }: { message: Message; collapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed ?? false);
  const [showQuoted, setShowQuoted] = useState(false);
  const outbound = message.direction === "outbound";

  const full = useMemo(
    () => (message.body_text || (message.body_html ? htmlToText(message.body_html) : "")).trim(),
    [message.body_text, message.body_html],
  );
  const visible = useMemo(() => stripQuoted(full), [full]);
  const hasQuoted = visible.length < full.length - 20;

  return (
    <article
      className={cn(
        "rounded-xl border bg-card transition-colors",
        outbound && "border-transparent bg-muted/60",
        collapsed && "cursor-pointer hover:bg-accent/40",
      )}
      onClick={collapsed ? () => setCollapsed(false) : undefined}
    >
      <header className="flex items-center gap-3 px-4 pt-3.5">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            outbound ? "bg-foreground text-background" : "bg-muted text-foreground",
          )}
        >
          {outbound ? "Du" : initials(message.from_name, message.from_email)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-medium">{outbound ? "Du" : message.from_name || message.from_email}</span>
            <span className="truncate text-xs text-muted-foreground">
              {outbound ? `via ${message.from_email}` : message.from_name ? message.from_email : ""}
            </span>
          </div>
          {collapsed && <p className="truncate text-muted-foreground">{visible.slice(0, 140)}</p>}
        </div>
        <time className="shrink-0 text-xs text-muted-foreground" dateTime={message.sent_at}>
          {longDate(message.sent_at)}
        </time>
      </header>
      {!collapsed && (
        <div className="px-4 pb-4 pl-[60px] pt-2">
          <div className="whitespace-pre-wrap break-words leading-relaxed">{showQuoted ? full : visible}</div>
          {hasQuoted && (
            <button
              onClick={() => setShowQuoted((v) => !v)}
              className="mt-2 rounded bg-muted px-1.5 text-xs font-medium tracking-widest text-muted-foreground hover:text-foreground"
              aria-label="Zitierten Text umschalten"
            >
              •••
            </button>
          )}
        </div>
      )}
    </article>
  );
}
