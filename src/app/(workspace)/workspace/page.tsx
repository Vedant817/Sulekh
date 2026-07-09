import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { listProjects } from "@/server/projects";

import { CreateProjectForm } from "./create-project-form";

const BOARD_LABEL: Record<string, string> = {
  BSE_SME: "BSE SME",
  NSE_EMERGE: "NSE Emerge",
};

export default async function WorkspacePage() {
  const user = await getCurrentUser();
  const name = user?.profile?.full_name ?? "there";
  const isPromoter = (user?.profile?.role ?? "promoter") === "promoter";
  const projects = await listProjects();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {name}</h1>
        <p className="text-muted-foreground">
          {isPromoter
            ? "Create an IPO project to begin the guided intake for a draft DRHP."
            : "Projects assigned to you for review will appear here."}
        </p>
      </div>

      {isPromoter ? <CreateProjectForm /> : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Your projects ({projects.length})
        </h2>
        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            No projects yet.
            {isPromoter ? " Create your first one above." : ""}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/workspace/${p.id}`}
                  className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-muted"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {BOARD_LABEL[p.target_board] ?? p.target_board} ·{" "}
                      {new Date(p.created_at).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium capitalize">
                    {p.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
