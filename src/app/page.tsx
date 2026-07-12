import Link from "next/link";
import {
  ClipboardList,
  FileScan,
  FileText,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

const pipeline = [
  {
    icon: ClipboardList,
    title: "Guided intake",
    description:
      "A branching questionnaire captures business, financial, legal, and promoter details in plain language — no capital-markets background required.",
  },
  {
    icon: FileScan,
    title: "Real document extraction",
    description:
      "Audited financials, cap tables, and litigation registers are parsed and turned into structured data — every value shown next to its source for the promoter to confirm or correct.",
  },
  {
    icon: Sparkles,
    title: "Grounded generation",
    description:
      "Every DRHP section is drafted from the confirmed data and the actual SEBI ICDR requirement text — dependency-ordered, provenance-tracked, and never inventing a figure it doesn't have.",
  },
  {
    icon: ScanSearch,
    title: "Gap & consistency checks",
    description:
      "An automated engine flags missing mandatory disclosures and figures that don't reconcile across sections — before a reviewer ever has to catch them.",
  },
  {
    icon: UserCheck,
    title: "Intermediary review",
    description:
      "An authorised merchant banker or legal counsel comments, edits, and approves section by section, with every action recorded in an immutable audit trail.",
  },
  {
    icon: FileText,
    title: "Gated export",
    description:
      "DOCX and PDF stay watermarked \"DRAFT — FOR AUTHORISED INTERMEDIARY REVIEW\" until every mandatory section is approved — only then does a final export unlock.",
  },
];

const principles = [
  {
    title: "Nothing is fabricated",
    description:
      "Generation is grounded strictly in confirmed issuer data and retrieved regulatory text. Anything unsupported is marked as an explicit gap, never guessed.",
  },
  {
    title: "Humans stay in control",
    description:
      "Extracted values require promoter confirmation before use. The intermediary's approval — not the model's — is what unlocks a final export.",
  },
  {
    title: "It authors, it never submits",
    description:
      "DRHP Studio produces a draft for review. It has no path to file with SEBI or an exchange — that decision and action stay entirely with your team.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-20 sm:py-28">
          <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            SEBI TechSprint · Problem Statement 4
          </span>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Drafting an IPO prospectus takes an SME months. We turn it into one guided session.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Preparing a Draft Red Herring Prospectus (DRHP) for a BSE SME / NSE
            Emerge listing is slow, manual, and expert-dependent — merchant
            bankers hand-draft each section, then hand-check it against SEBI&rsquo;s
            ICDR requirements. <strong className="text-foreground">DRHP Studio</strong> is
            the authoring tool that does that first pass for you: a guided
            intake, real document extraction, a grounded first draft, automated
            gap-checking, and a mandatory intermediary sign-off — before anything
            is exported.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button size="lg" render={<Link href="/login" />}>
              Get started
            </Button>
            <Button size="lg" variant="outline" render={<Link href="#how-it-works" />}>
              See how it works
            </Button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto w-full max-w-5xl px-6 py-20">
        <div className="mb-10 flex flex-col gap-3">
          <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            How it works
          </span>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            From a blank intake form to a reviewable draft
          </h2>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            One pipeline, six stages, each one grounded in real data and checked
            before it moves forward.
          </p>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2">
          {pipeline.map((step, i) => (
            <li key={step.title}>
              <Card className="h-full">
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <step.icon className="size-4.5" strokeWidth={2} />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Step {i + 1}
                    </span>
                  </div>
                  <CardTitle className="text-base">{step.title}</CardTitle>
                  <CardDescription className="text-sm leading-6">
                    {step.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Who it's for */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto grid w-full max-w-5xl gap-6 px-6 py-20 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              For the promoter
            </span>
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">
              Answer questions, upload documents, review a draft.
            </h3>
            <p className="text-base leading-7 text-muted-foreground">
              No capital-markets expertise required going in. The guided intake
              adapts to your business type and offer structure, and every
              extracted figure is shown next to its source for you to confirm.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              For the intermediary
            </span>
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">
              Review a clean, largely-complete draft — not a blank page.
            </h3>
            <p className="text-base leading-7 text-muted-foreground">
              Merchant bankers and legal counsel comment, edit, and approve
              section by section, with coverage against every SME/ICDR
              requirement and an immutable audit trail of every decision.
            </p>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="mx-auto w-full max-w-5xl px-6 py-20">
        <div className="mb-10 flex items-center gap-3">
          <ShieldCheck className="size-6 text-primary" strokeWidth={2} />
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Built to be trusted with a regulatory document
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {principles.map((p) => (
            <div key={p.title} className="flex flex-col gap-2">
              <h3 className="font-medium text-foreground">{p.title}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{p.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-start gap-4 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold text-foreground">
              Ready to draft your DRHP?
            </span>
            <span className="text-sm text-muted-foreground">
              Sign in to start a guided intake or check live system status.
            </span>
          </div>
          <div className="flex gap-3">
            <Button render={<Link href="/login" />}>Get started</Button>
            <Button variant="outline" render={<Link href="/api/health" />}>
              System health
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
