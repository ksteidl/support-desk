"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Search, Sparkles, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StoreDot } from "@/components/store-dot";
import { SyncButton } from "./sync-button";
import { useHotkeys } from "@/lib/hooks/use-hotkeys";
import { shortDate } from "@/lib/format";
import { CATEGORY_LABELS, type Store, type Ticket, type TicketStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ListTicket = Pick<
  Ticket,
  | "id"
  | "store_id"
  | "customer_email"
  | "customer_name"
  | "subject"
  | "snippet"
  | "status"
  | "unread"
  | "has_draft"
  | "order_numbers"
  | "category"
  | "last_message_at"
>;

const COLUMNS =
  "id, store_id, customer_email, customer_name, subject, snippet, status, unread, has_draft, order_numbers, category, last_message_at";

const TABS: { value: TicketStatus; label: string }[] = [
  { value: "open", label: "Offen" },
  { value: "waiting", label: "Wartend" },
  { value: "closed", label: "Erledigt" },
];

export function TicketList({
  stores,
  userId,
  initial = null,
}: {
  stores: Pick<Store, "id" | "name" | "color">[];
  userId: string;
  initial?: ListTicket[] | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { id: activeId } = useParams<{ id?: string }>();
  const [, startTransition] = useTransition();

  const status = (params.get("status") as TicketStatus) ?? "open";
  const storeId = params.get("store") ?? "all";
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [tickets, setTickets] = useState<ListTicket[] | null>(initial);
  const [counts, setCounts] = useState<Record<TicketStatus, number>>({ open: 0, waiting: 0, closed: 0 });
  const searchRef = useRef<HTMLInputElement>(null);
  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  const load = useCallback(async () => {
    let q = supabase.from("tickets").select(COLUMNS).eq("status", status).order("last_message_at", { ascending: false }).limit(200);
    if (storeId !== "all") q = q.eq("store_id", storeId);
    const term = query.trim().replace(/[,()%]/g, " ");
    if (term) {
      const like = `%${term}%`;
      const filters = [`subject.ilike.${like}`, `customer_email.ilike.${like}`, `customer_name.ilike.${like}`, `snippet.ilike.${like}`];
      const order = term.replace(/^#/, "").toUpperCase();
      if (/^[A-Z]{0,6}-?\d{3,}$/.test(order)) filters.push(`order_numbers.cs.{${order}}`);
      q = q.or(filters.join(","));
    }
    const { data, error } = await q;
    if (error) return;
    setTickets((data as ListTicket[]) ?? []);

    const countQuery = (s: TicketStatus) => {
      let c = supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", s);
      if (storeId !== "all") c = c.eq("store_id", storeId);
      return c;
    };
    const [o, w] = await Promise.all([countQuery("open"), countQuery("waiting")]);
    setCounts({ open: o.count ?? 0, waiting: w.count ?? 0, closed: 0 });
  }, [supabase, status, storeId, query]);

  // Suche entprellen
  useEffect(() => {
    const t = setTimeout(load, query ? 200 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  // Live-Updates
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel("tickets-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets", filter: `user_id=eq.${userId}` }, () => {
        clearTimeout(t);
        t = setTimeout(load, 300);
      })
      .subscribe();
    return () => {
      clearTimeout(t);
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, load]);

  const href = (id: string) => `/inbox/${id}${params.size ? `?${params}` : ""}`;
  const move = (dir: 1 | -1) => {
    if (!tickets?.length) return;
    const idx = tickets.findIndex((t) => t.id === activeId);
    const next = tickets[Math.min(Math.max(idx + dir, 0), tickets.length - 1)] ?? tickets[0];
    router.push(href(next.id), { scroll: false });
    document.getElementById(`t-${next.id}`)?.scrollIntoView({ block: "nearest" });
  };

  useHotkeys({
    j: () => move(1),
    k: () => move(-1),
    arrowdown: () => move(1),
    arrowup: () => move(-1),
    "/": () => searchRef.current?.focus(),
    "mod+k": () => searchRef.current?.focus(),
    escape: () => {
      if (document.activeElement === searchRef.current) searchRef.current?.blur();
    },
  });

  return (
    <section className={cn("flex w-full shrink-0 flex-col border-r md:w-[360px]", activeId && "hidden md:flex")}>
      <header className="space-y-3 border-b px-3 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <h1 className="flex-1 pl-1 text-base font-semibold tracking-tight">Inbox</h1>
          {stores.length > 1 && (
            <Select value={storeId} onValueChange={(v) => setParam("store", v === "all" ? null : v)}>
              <SelectTrigger size="sm" className="h-8 w-auto max-w-40 gap-2 border-none bg-transparent shadow-none hover:bg-accent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">Alle Stores</SelectItem>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <StoreDot color={s.color} /> {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <SyncButton />
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            onKeyDown={(e) => e.key === "Enter" && setParam("q", query || null)}
            placeholder="Name, E-Mail, Bestellnummer…"
            className="h-8 bg-muted/60 pl-8 pr-8 shadow-none"
          />
          <Kbd className="absolute right-2 top-1/2 -translate-y-1/2">/</Kbd>
        </div>

        <div className="flex gap-1 rounded-lg bg-muted/60 p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setParam("status", tab.value === "open" ? null : tab.value)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium text-muted-foreground transition-colors",
                status === tab.value && "bg-background text-foreground shadow-sm",
              )}
            >
              {tab.label}
              {tab.value !== "closed" && counts[tab.value] > 0 && (
                <span className="tabular-nums text-muted-foreground">{counts[tab.value]}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {tickets === null ? (
          <div className="space-y-px p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-lg p-3">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 p-8 text-center">
            <p className="font-medium">{query ? "Keine Treffer" : status === "open" ? "Inbox Zero 🎉" : "Nichts hier"}</p>
            <p className="text-muted-foreground">
              {query ? "Versuche einen anderen Suchbegriff." : status === "open" ? "Alle Anfragen sind beantwortet." : ""}
            </p>
          </div>
        ) : (
          <ul className="p-1.5">
            {tickets.map((t) => {
              const store = storeMap.get(t.store_id);
              const active = t.id === activeId;
              return (
                <li key={t.id} id={`t-${t.id}`}>
                  <Link
                    href={href(t.id)}
                    scroll={false}
                    className={cn(
                      "group block rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/70",
                      active && "bg-accent hover:bg-accent",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {t.unread && <span className="size-1.5 shrink-0 rounded-full bg-ai" />}
                      <span className={cn("flex-1 truncate", t.unread ? "font-semibold" : "font-medium")}>
                        {t.customer_name || t.customer_email}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{shortDate(t.last_message_at)}</span>
                    </div>
                    <p className={cn("mt-0.5 truncate", t.unread ? "text-foreground" : "text-foreground/80")}>{t.subject}</p>
                    <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">{t.snippet}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                      {stores.length > 1 && store && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <StoreDot color={store.color} className="size-1.5" />
                          {store.name}
                        </span>
                      )}
                      {t.order_numbers.slice(0, 2).map((n) => (
                        <span key={n} className="rounded bg-muted px-1.5 py-px font-mono text-muted-foreground">
                          #{n}
                        </span>
                      ))}
                      {t.category && t.category !== "other" && (
                        <span className="rounded border px-1.5 py-px text-muted-foreground">{CATEGORY_LABELS[t.category]}</span>
                      )}
                      {t.has_draft && t.status === "open" && (
                        <span className="ml-auto inline-flex items-center gap-1 rounded bg-ai-muted px-1.5 py-px font-medium text-ai">
                          <Sparkles className="size-3" /> Entwurf
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="hidden items-center gap-3 border-t px-4 py-2 text-[11px] text-muted-foreground md:flex">
        <span>
          <Kbd>J</Kbd> <Kbd>K</Kbd> navigieren
        </span>
        <span>
          <Kbd>E</Kbd> erledigt
        </span>
        <span>
          <Kbd>R</Kbd> antworten
        </span>
        {stores.length === 0 && (
          <Link href="/settings" className="ml-auto inline-flex items-center gap-1 text-amber-600">
            <TriangleAlert className="size-3" /> Store einrichten
          </Link>
        )}
      </footer>
    </section>
  );
}
