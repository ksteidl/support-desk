import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { requireUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { supabase, email } = await requireUser();
  const { count } = await supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "open");

  return (
    <div className="flex h-svh overflow-hidden">
      <Suspense>
        <AppSidebar email={email} openCount={count ?? 0} />
      </Suspense>
      <main className="flex min-w-0 flex-1">{children}</main>
    </div>
  );
}
