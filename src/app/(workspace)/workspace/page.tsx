import { getCurrentUser } from "@/lib/auth";

export default async function WorkspacePage() {
  const user = await getCurrentUser();
  const name = user?.profile?.full_name ?? "there";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {name}</h1>
        <p className="text-muted-foreground">
          Your IPO projects will appear here. Create one to begin the guided
          intake for a draft DRHP.
        </p>
      </div>
      {/* Project list + creation is wired in task 0.7. */}
    </div>
  );
}
