import { AuthForm } from "@/components/auth-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return <AuthForm mode="login" notice={error === "confirm" ? "Bestätigungslink ungültig oder abgelaufen." : undefined} />;
}
