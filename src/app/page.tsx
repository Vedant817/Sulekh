import Link from "next/link";
import { Button } from "@/components/ui/button";

const journey = [
  "Guided intake captures business, financial & legal particulars",
  "Real document parsing → promoter-confirmed structured entities",
  "Grounded, provenance-tracked generation of every DRHP section",
  "Automated gap & consistency flagging against the SME framework",
  "Authorised-intermediary review gate before any un-watermarked export",
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-24">
      <div className="flex flex-col gap-4">
        <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          SEBI TechSprint · Problem Statement 4
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          DRHP Studio
        </h1>
        <p className="max-w-xl text-lg leading-8 text-muted-foreground">
          Author a disclosure-ready draft DRHP for an SME IPO — grounded in the
          issuer&rsquo;s own data and SEBI&rsquo;s ICDR / SME framework, with
          automated gap flagging and a mandatory authorised-intermediary review
          gate before any export.
        </p>
      </div>

      <ol className="flex flex-col gap-3">
        {journey.map((step, i) => (
          <li key={step} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <span className="text-base leading-7 text-foreground">{step}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        <Button size="lg" render={<Link href="/login" />}>
          Get started
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/api/health" />}>
          System health
        </Button>
      </div>
    </main>
  );
}
