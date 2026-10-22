import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StoreDot } from "@/components/store-dot";
import { MessageItem } from "@/components/inbox/message-item";
import { ContextPanel } from "@/components/inbox/context-panel";
import { initials, longDate } from "@/lib/format";
import type { Message, Store, Ticket } from "@/lib/types";

const STATUS: Record<string, string> = { open: "Offen", waiting: "Wartend", closed: "Erledigt" };

export default async function CustomerPage({ params }: PageProps<"/customers/[email]">) {
  const email = decodeURIComponent((await params).email).toLowerCase();
  const { supabase } = await requireUser();

  const { data: tickets } = await supabase
    .from("tickets")
    .select("*")
    .eq("customer_email", email)
    .order("last_message_at", { ascending: false })
    .returns<Ticket[]>();
  if (!tickets?.length) notFound();

  const ids = tickets.map((t) => t.id);
  const [{ data: messages }, { data: stores }] = await Promise.all([
    supabase.from("messages").select("*").in("ticket_id", ids).order("sent_at").returns<Message[]>(),
    supabase.from("stores").select("*").returns<Store[]>(),
  ]);
  const storeMap = new Map((stores ?? []).map((s) => [s.id, s]));
  const byTicket = new Map<string, Message[]>();
  for (const m of messages ?? []) byTicket.set(m.ticket_id, [...(byTicket.get(m.ticket_id) ?? []), m]);

  const name = tickets.find((t) => t.customer_name)?.customer_name ?? null;
  const withContext = tickets.find((t) => t.shopify_context);
  const total = messages?.length ?? 0;

  return (
    <div className="flex min-w-0 flex-1">
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <Button variant="ghost" size="sm" className="-ml-2 mb-4 text-muted-foreground" asChild>
            <Link href="/customers">
              <ArrowLeft /> Kunden
            </Link>
          </Button>
          <div className="mb-8 flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-base font-semibold">{initials(name, email)}</div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{name || email}</h1>
              <p className="text-muted-foreground">
                {email} · {tickets.length} {tickets.length === 1 ? "Anfrage" : "Anfragen"} · {total} Nachrichten
              </p>
            </div>
          </div>

          <ol className="relative space-y-10 border-l pl-6">
            {tickets.map((t) => {
              const store = storeMap.get(t.store_id);
              return (
                <li key={t.id} className="relative">
                  <span className="absolute -left-[29px] top-1.5 size-2.5 rounded-full border-2 border-background bg-foreground" />
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Link href={`/inbox/${t.id}?status=${t.status}`} className="group inline-flex items-center gap-1 font-medium hover:underline">
                      {t.subject}
                      <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                    <Badge variant={t.status === "open" ? "default" : "secondary"} className="font-normal">
                      {STATUS[t.status]}
                    </Badge>
                    {store && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <StoreDot color={store.color} className="size-1.5" /> {store.name}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">{longDate(t.created_at)}</span>
                  </div>
                  {t.summary && <p className="mb-3 text-muted-foreground">{t.summary}</p>}
                  <div className="space-y-2">
                    {(byTicket.get(t.id) ?? []).map((m) => (
                      <MessageItem key={m.id} message={m} collapsed />
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      {withContext && storeMap.get(withContext.store_id) && (
        <aside className="scrollbar-thin hidden w-[320px] shrink-0 overflow-y-auto border-l bg-muted/20 xl:block">
          <ContextPanel
            context={withContext.shopify_context}
            store={storeMap.get(withContext.store_id)!}
            customerEmail={email}
            customerName={name}
            summary={null}
            category={null}
            previousTickets={0}
          />
        </aside>
      )}
    </div>
  );
}
