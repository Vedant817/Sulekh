import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  const dest = redirectTo?.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/workspace";
  return <LoginForm redirectTo={dest} />;
}
