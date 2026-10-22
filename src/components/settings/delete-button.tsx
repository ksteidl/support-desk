"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteMailbox, deleteStore } from "@/app/actions/stores";

export function DeleteButton({ kind, id, name }: { kind: "store" | "mailbox"; id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label="Löschen">
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>„{name}“ löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            {kind === "store"
              ? "Der Store inkl. aller Postfächer, Tickets und Nachrichten wird dauerhaft aus der App gelöscht."
              : "Das Postfach inkl. aller zugehörigen Tickets wird aus der App gelöscht. Dein echtes E-Mail-Postfach bleibt unberührt."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() =>
              start(async () => {
                const res = kind === "store" ? await deleteStore(id) : await deleteMailbox(id);
                if (!res.ok) return void toast.error(res.error);
                toast.success("Gelöscht");
                router.refresh();
              })
            }
          >
            Löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
