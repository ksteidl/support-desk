"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string } | undefined;

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email")),
    password: String(form.get("password")),
  });
  if (error) return { error: error.message === "Invalid login credentials" ? "E-Mail oder Passwort falsch." : error.message };
  redirect("/inbox");
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { data, error } = await supabase.auth.signUp({
    email: String(form.get("email")),
    password: String(form.get("password")),
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { full_name: String(form.get("name") ?? "") },
    },
  });
  if (error) return { error: error.message };
  if (!data.session) return { message: "Fast geschafft – bitte bestätige deine E-Mail-Adresse über den Link in deinem Postfach." };
  redirect("/settings?welcome=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
