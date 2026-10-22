import { Suspense } from "react";
import { TicketList } from "@/components/inbox/ticket-list";
import { requireUser } from "@/lib/supabase/server";

export default async function InboxLayout({ children }: LayoutProps<"/inbox">) {
  const { supabase, userId } = await requireUser();
  const { data: stores } = await supabase.from("stores").select("id, name, color").order("created_at");

  return (
    <>
      <Suspense>
        <TicketList stores={stores ?? []} userId={userId} />
      </Suspense>
      <div className="flex min-w-0 flex-1">{children}</div>
    </>
  );
}
