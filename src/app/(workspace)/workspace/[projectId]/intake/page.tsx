import { Check, Circle, FileCheck2, FileUp, ListChecks, TriangleAlert, WandSparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { listDocuments } from "@/server/extraction/documents";
import { listExtractedEntities } from "@/server/extraction/entities";
import { intakeProgress } from "@/server/intake/questionnaire";
import { loadAnswers } from "@/server/intake/store";
import { getProject } from "@/server/projects";

import { DocumentList } from "../documents/document-list";
import { ExtractedEntities } from "../documents/extracted-entities";
import { UploadForm } from "../documents/upload-form";
import { IntakeForm } from "./intake-form";

type SetupStep = {
  href: string;
  label: string;
  detail: string;
  complete: boolean;
};

function StepLink({ step, index }: { step: SetupStep; index: number }) {
  return (
    <a
      href={step.href}
      className="group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
    >
      <span
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
          step.complete
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-border bg-background text-muted-foreground"
        }`}
      >
        {step.complete ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium group-hover:underline">{step.label}</span>
        <span className="block text-xs leading-5 text-muted-foreground">{step.detail}</span>
      </span>
    </a>
  );
}

export default async function IntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ from?: string; section?: string; requirement?: string; focus?: string }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const project = await getProject(projectId);
  if (!project) notFound();

  const [answers, documents, entities] = await Promise.all([
    loadAnswers(projectId),
    listDocuments(projectId),
    listExtractedEntities(projectId),
  ]);

  const progress = intakeProgress(answers);
  const confirmedCount = entities.filter((entity) => entity.confirmed_by_promoter).length;
  const documentsComplete = documents.length > 0;
  const reviewComplete = entities.length > 0 && confirmedCount === entities.length;
  const setupComplete = progress.complete && documentsComplete && reviewComplete;
  const steps: SetupStep[] = [
    {
      href: "#details",
      label: "Issuer details",
      detail: `${progress.requiredAnswered}/${progress.requiredVisible} required answered`,
      complete: progress.complete,
    },
    {
      href: "#documents",
      label: "Source documents",
      detail: documents.length === 0 ? "Add supporting files" : `${documents.length} uploaded`,
      complete: documentsComplete,
    },
    {
      href: "#review",
      label: "Review extraction",
      detail:
        entities.length === 0
          ? "Waiting for extracted values"
          : `${confirmedCount}/${entities.length} confirmed`,
      complete: reviewComplete,
    },
  ];
  const completedSteps = steps.filter((step) => step.complete).length;
  const focusedSetupStep = query.from === "gaps" ? query.focus : null;
  const focusedStepClass =
    "border border-amber-400 bg-amber-50/60 ring-4 ring-amber-200";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7">
      <div className="flex flex-col gap-2">
        <Link href={`/workspace/${projectId}`} className="text-sm text-muted-foreground hover:underline">
          ← {project.name}
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Promoter workspace
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Complete issuer setup in one place</h1>
            <p className="mt-1 max-w-3xl text-muted-foreground">
              Enter particulars, add every source document together, and verify extracted values without moving between pages.
            </p>
          </div>
          {setupComplete ? (
            <Button size="lg" render={<Link href={`/workspace/${projectId}/generate`} />}>
              <WandSparkles aria-hidden="true" /> Generate grounded draft
            </Button>
          ) : null}
        </div>
      </div>

      {query.from === "gaps" ? (
        <aside className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">You are correcting a flagged disclosure</h2>
              <p className="mt-1 text-sm text-amber-900/80">
                Update the issuer facts or confirmed extracted values for
                {query.section ? ` “${query.section}”` : " the affected section"}
                {query.requirement ? ` (${query.requirement})` : ""}. Then regenerate the draft and re-run coverage checks.
              </p>
            </div>
          </div>
          <Link
            href={`/workspace/${projectId}/gaps`}
            className="shrink-0 text-sm font-medium underline underline-offset-4"
          >
            Back to gaps
          </Link>
        </aside>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="lg:relative">
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-3 lg:sticky lg:top-6">
            <div className="px-2 pt-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Setup progress</span>
                <span className="text-muted-foreground">{completedSteps}/3</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-600 transition-all"
                  style={{ width: `${(completedSteps / steps.length) * 100}%` }}
                />
              </div>
            </div>
            <nav aria-label="Issuer setup steps" className="grid gap-1">
              {steps.map((step, index) => (
                <StepLink key={step.href} step={step} index={index} />
              ))}
            </nav>
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
              Every answer saves automatically. Uploaded values remain excluded from drafting until you confirm them.
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-8">
          <section
            id="details"
            data-focused={focusedSetupStep === "details" ? "true" : undefined}
            className={`scroll-mt-28 space-y-4 rounded-xl p-1 transition-all ${focusedSetupStep === "details" ? focusedStepClass : ""}`}
          >
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ListChecks className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">1. Issuer details</h2>
                <p className="text-sm text-muted-foreground">
                  The questionnaire adapts to the issuer and offer structure. Required answers save as you go.
                </p>
              </div>
            </div>
            <IntakeForm projectId={projectId} initialAnswers={answers} />
          </section>

          <section id="documents" className="scroll-mt-28 space-y-4 rounded-xl border-t pt-8">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <FileUp className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">2. Source documents</h2>
                <p className="text-sm text-muted-foreground">
                  Select multiple files once. Sulekh stores them privately and automatically runs the real extraction path where supported.
                </p>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <UploadForm projectId={projectId} />
            </div>
            <DocumentList projectId={projectId} documents={documents} />
          </section>

          <section
            id="review"
            data-focused={focusedSetupStep === "review" ? "true" : undefined}
            className={`scroll-mt-28 space-y-4 rounded-xl border-t pt-8 transition-all ${focusedSetupStep === "review" ? focusedStepClass : ""}`}
          >
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <FileCheck2 className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">3. Review extracted values</h2>
                <p className="text-sm text-muted-foreground">
                  Compare values with their evidence, correct anything inaccurate, then explicitly confirm each reviewed group.
                </p>
              </div>
            </div>
            {entities.length > 0 ? (
              <ExtractedEntities projectId={projectId} entities={entities} />
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
                <Circle className="size-5 text-muted-foreground" aria-hidden="true" />
                <p className="font-medium">No extracted values to review yet</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Upload audited financials, a cap table, litigation register, or KMP/promoter KYC above. Extraction starts automatically.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border bg-muted/30 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {setupComplete ? (
                    <FileCheck2 className="size-5 text-emerald-700" aria-hidden="true" />
                  ) : (
                    <Circle className="size-5 text-muted-foreground" aria-hidden="true" />
                  )}
                  <h2 className="text-lg font-semibold">
                    {setupComplete ? "Issuer setup is ready" : "Finish the steps above"}
                  </h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {setupComplete
                    ? "Drafting will use only saved answers and promoter-confirmed extracted values."
                    : "The progress panel shows the next incomplete step; nothing unconfirmed will enter the draft."}
                </p>
              </div>
              {setupComplete ? (
                <Button size="lg" render={<Link href={`/workspace/${projectId}/generate`} />}>
                  <WandSparkles aria-hidden="true" /> Generate grounded draft
                </Button>
              ) : null}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
