import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TicketView } from "@/components/inbox/ticket-view";
import { requireUser } from "@/lib/supabase/server";
import { aiEnabled } from "@/lib/ai";
import type { Draft, Mailbox, Message, Store, Ticket } from "@/lib/types";

export default async function TicketPage({ params }: PageProps<"/inbox/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: ticket } = await supabase.from("tickets").select("*").eq("id", id).maybeSingle<Ticket>();
  if (!ticket) notFound();

  const [{ data: messages }, { data: draft }, { data: store }, { data: mailbox }, { count }] = await Promise.all([
    supabase.from("messages").select("*").eq("ticket_id", id).order("sent_at").returns<Message[]>(),
    supabase.from("drafts").select("*").eq("ticket_id", id).maybeSingle<Draft>(),
    supabase.from("stores").select("*").eq("id", ticket.store_id).single<Store>(),
    supabase.from("mailboxes").select("email").eq("id", ticket.mailbox_id).single<Pick<Mailbox, "email">>(),
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("customer_email", ticket.customer_email)
      .neq("id", id),
  ]);
  if (!store) notFound();

  return (
    <Suspense>
      <TicketView
        ticket={ticket}
        messages={messages ?? []}
        draft={draft}
        store={store}
        fromEmail={mailbox?.email ?? ""}
        previousTickets={count ?? 0}
        aiEnabled={aiEnabled()}
      />
    </Suspense>
  );
}
