"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Inbox, LogOut, Moon, Settings, Sun, Users } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/customers", label: "Kunden", icon: Users },
  { href: "/settings", label: "Stores & Postfächer", icon: Settings },
];

export function AppSidebar({ email, openCount }: { email: string; openCount: number }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-3">
      <Link href="/inbox" className="mb-3">
        <Logo />
      </Link>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Tooltip key={href}>
            <TooltipTrigger asChild>
              <Link
                href={href}
                className={cn(
                  "relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                  active && "bg-sidebar-accent text-foreground",
                )}
              >
                <Icon className="size-[18px]" />
                {href === "/inbox" && openCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background tabular-nums">
                    {openCount > 99 ? "99+" : openCount}
                  </span>
                )}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        );
      })}

      <div className="mt-auto">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase outline-none ring-ring/50 hover:ring-2">
            {email.slice(0, 2)}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-56">
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              {resolvedTheme === "dark" ? <Sun /> : <Moon />}
              {resolvedTheme === "dark" ? "Helles Design" : "Dunkles Design"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut /> Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
