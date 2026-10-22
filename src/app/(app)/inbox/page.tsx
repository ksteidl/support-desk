import { Inbox } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";

export default function InboxIndex() {
  return (
    <div className="hidden flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground md:flex">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
        <Inbox className="size-5" />
      </div>
      <div>
        <p className="font-medium text-foreground">Wähle eine Anfrage</p>
        <p className="mt-1">
          Mit <Kbd>J</Kbd> starten oder <Kbd>/</Kbd> zum Suchen.
        </p>
      </div>
    </div>
  );
}
