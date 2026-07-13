"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import type { IntakeProgress } from "@/server/intake/questionnaire";

export const INTAKE_PROGRESS_EVENT = "sulekh:intake-progress";

export type SetupStep = {
  href: string;
  label: string;
  detail: string;
  complete: boolean;
};

export function SetupProgress({ initialSteps }: { initialSteps: SetupStep[] }) {
  const [steps, setSteps] = useState(initialSteps);

  useEffect(() => {
    function updateIntakeProgress(event: Event): void {
      const progress = (event as CustomEvent<IntakeProgress>).detail;
      setSteps((current) =>
        current.map((step, index) =>
          index === 0
            ? {
                ...step,
                detail: `${progress.requiredAnswered}/${progress.requiredVisible} required answered`,
                complete: progress.complete,
              }
            : step,
        ),
      );
    }

    window.addEventListener(INTAKE_PROGRESS_EVENT, updateIntakeProgress);
    return () => window.removeEventListener(INTAKE_PROGRESS_EVENT, updateIntakeProgress);
  }, []);

  const completedSteps = steps.filter((step) => step.complete).length;

  return (
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
          <a
            key={step.href}
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
        ))}
      </nav>
      <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
        Every answer saves automatically. Uploaded values remain excluded from drafting until you confirm them.
      </div>
    </div>
  );
}
