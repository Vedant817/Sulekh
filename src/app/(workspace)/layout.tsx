import Link from "next/link";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth: middleware already gates this, but never render workspace
  // chrome for an unauthenticated request.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = user.profile?.role ?? "promoter";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href="/workspace" className="font-semibold tracking-tight">
          Sulekh
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end leading-tight">
            <span className="text-sm">{user.email}</span>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {role}
            </span>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
