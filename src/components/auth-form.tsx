"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { signIn, signUp, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";

export function AuthForm({ mode, notice }: { mode: "login" | "signup"; notice?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? signIn : signUp, undefined);
  const isLogin = mode === "login";

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo className="size-10 rounded-xl" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{isLogin ? "Willkommen zurück" : "Account erstellen"}</h1>
            <p className="mt-1 text-muted-foreground">
              {isLogin ? "Melde dich an, um deine Inbox zu öffnen." : "KI-Support für all deine Shopify-Stores."}
            </p>
          </div>
        </div>

        <form action={action} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" autoComplete="name" placeholder="Max Mustermann" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" autoFocus placeholder="du@shop.de" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={isLogin ? undefined : 8}
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </div>

          {(state?.error || notice) && <p className="text-sm text-destructive">{state?.error ?? notice}</p>}
          {state?.message && <p className="rounded-md bg-muted p-3 text-sm">{state.message}</p>}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {isLogin ? "Anmelden" : "Registrieren"}
          </Button>
        </form>

        <p className="mt-6 text-center text-muted-foreground">
          {isLogin ? "Noch keinen Account? " : "Schon registriert? "}
          <Link href={isLogin ? "/signup" : "/login"} className="font-medium text-foreground underline-offset-4 hover:underline">
            {isLogin ? "Registrieren" : "Anmelden"}
          </Link>
        </p>
      </div>
    </div>
  );
}
