"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useTransition } from "react";
import { ArrowLeft, Check, Clock, PanelRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { markRead, setTicketStatus } from "@/app/actions/tickets";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StoreDot } from "@/components/store-dot";
import { Composer, type ComposerHandle } from "./composer";
import { ContextPanel } from "./context-panel";
import { MessageItem } from "./message-item";
import { useHotkeys } from "@/lib/hooks/use-hotkeys";
import type { Draft, Message, Store, Ticket, TicketStatus } from "@/lib/types";

export function TicketView({
  ticket,
  messages,
  draft,
  store,
  fromEmail,
  previousTickets,
  aiEnabled,
}: {
  ticket: Ticket;
  messages: Message[];
  draft: Draft | null;
  store: Store;
  fromEmail: string;
  previousTickets: number;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const composer = useRef<ComposerHandle>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();
  const supabase = useMemo(() => createClient(), []);
  const listHref = `/inbox${params.size ? `?${params}` : ""}`;

  useEffect(() => {
    if (ticket.unread) markRead(ticket.id);
    bottom.current?.scrollIntoView({ block: "end" });
  }, [ticket.id, ticket.unread]);

  // Neuer Entwurf oder neue Nachricht im Hintergrund → Ansicht aktualisieren
  useEffect(() => {
    const channel = supabase
      .channel(`ticket-${ticket.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tickets", filter: `id=eq.${ticket.id}` }, (payload) => {
        const next = payload.new as Ticket;
        if (next.last_message_at !== ticket.last_message_at || (next.has_draft && !draft)) router.refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, ticket.id, ticket.last_message_at, draft, router]);

  function changeStatus(status: TicketStatus) {
    startTransition(async () => {
      const res = await setTicketStatus(ticket.id, status);
      if (!res.ok) return void toast.error(res.error);
      if (status === "closed") {
        toast.success("Als erledigt markiert", {
          action: { label: "Rückgängig", onClick: () => setTicketStatus(ticket.id, ticket.status).then(() => router.refresh()) },
        });
        router.push(listHref);
      } else {
        router.refresh();
      }
    });
  }

  useHotkeys({
    e: () => changeStatus("closed"),
    r: () => composer.current?.focus(),
    g: () => composer.current?.regenerate(),
    escape: () => router.push(listHref),
  });

  const panel = (
    <ContextPanel
      context={ticket.shopify_context}
      store={store}
      customerEmail={ticket.customer_email}
      customerName={ticket.customer_name}
      summary={ticket.summary}
      category={ticket.category}
      previousTickets={previousTickets}
    />
  );

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-4 py-2.5">
          <Button variant="ghost" size="icon-sm" className="md:hidden" asChild>
            <Link href={listHref} aria-label="Zurück">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold tracking-tight">{ticket.subject}</h2>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <StoreDot color={store.color} className="size-1.5" />
              {store.name} ·
              <Link href={`/customers/${encodeURIComponent(ticket.customer_email)}`} className="truncate hover:text-foreground hover:underline">
                {ticket.customer_name ? `${ticket.customer_name} <${ticket.customer_email}>` : ticket.customer_email}
              </Link>
            </p>
          </div>

          {ticket.status === "open" ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => changeStatus("waiting")}>
                    <Clock /> <span className="hidden lg:inline">Wartend</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Auf Kunden warten</TooltipContent>
              </Tooltip>
              <Button variant="outline" size="sm" onClick={() => changeStatus("closed")}>
                <Check /> Erledigt <Kbd className="hidden lg:inline-flex">E</Kbd>
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => changeStatus("open")}>
              <RotateCcw /> Wieder öffnen
            </Button>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="xl:hidden" aria-label="Kundendaten">
                <PanelRight />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[360px] overflow-y-auto p-0 sm:max-w-[360px]">
              <SheetHeader className="border-b">
                <SheetTitle>Kunde & Bestellungen</SheetTitle>
              </SheetHeader>
              {panel}
            </SheetContent>
          </Sheet>
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-3 px-4 py-5">
            {messages.map((m, i) => (
              <MessageItem key={m.id} message={m} collapsed={messages.length > 3 && i < messages.length - 2} />
            ))}
            <div ref={bottom} />
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          <Composer
            key={ticket.id}
            ref={composer}
            ticketId={ticket.id}
            draft={draft}
            aiEnabled={aiEnabled}
            fromEmail={fromEmail}
            onSent={(closed) => (closed ? router.push(listHref) : router.refresh())}
          />
        </div>
      </div>

      <aside className="scrollbar-thin hidden w-[320px] shrink-0 overflow-y-auto border-l bg-muted/20 xl:block">{panel}</aside>
    </div>
  );
}
