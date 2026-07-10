"use client";

import { useMemo, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GROUPS,
  intakeProgress,
  visibleQuestions,
  type Answers,
  type Question,
} from "@/server/intake/questionnaire";

import { saveAnswerAction } from "./actions";

type FieldState = "idle" | "saving" | "saved" | "error";

export function IntakeForm({
  projectId,
  initialAnswers,
}: {
  projectId: string;
  initialAnswers: Answers;
}) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, FieldState>>({});
  const [, startTransition] = useTransition();

  const visible = useMemo(() => visibleQuestions(answers), [answers]);
  const progress = useMemo(() => intakeProgress(answers), [answers]);
  const visibleIds = useMemo(() => new Set(visible.map((q) => q.id)), [visible]);

  function persist(q: Question, value: unknown) {
    setStatus((s) => ({ ...s, [q.id]: "saving" }));
    startTransition(async () => {
      const res = await saveAnswerAction(projectId, q.id, value);
      if (res.ok) {
        setErrors((e) => ({ ...e, [q.id]: "" }));
        setStatus((s) => ({ ...s, [q.id]: "saved" }));
      } else {
        setErrors((e) => ({ ...e, [q.id]: res.error ?? "Invalid" }));
        setStatus((s) => ({ ...s, [q.id]: "error" }));
      }
    });
  }

  function setLocal(id: string, value: unknown) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  function renderField(q: Question) {
    const value = answers[q.id];
    const err = errors[q.id];
    const st = status[q.id];
    const common = { id: q.id, name: q.id, "aria-invalid": Boolean(err) };

    let control: React.ReactNode;
    if (q.type === "select") {
      control = (
        <select
          {...common}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => {
            setLocal(q.id, e.target.value);
            persist(q, e.target.value);
          }}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="" disabled>
            Select…
          </option>
          {q.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    } else if (q.type === "boolean") {
      control = (
        <div className="flex gap-2">
          {[
            { v: true, l: "Yes" },
            { v: false, l: "No" },
          ].map(({ v, l }) => (
            <button
              key={l}
              type="button"
              aria-pressed={value === v}
              onClick={() => {
                setLocal(q.id, v);
                persist(q, v);
              }}
              className={`rounded-lg border px-3 py-1 text-sm ${
                value === v ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      );
    } else if (q.type === "textarea") {
      control = (
        <textarea
          {...common}
          defaultValue={typeof value === "string" ? value : ""}
          maxLength={q.maxLength}
          rows={4}
          onBlur={(e) => {
            setLocal(q.id, e.target.value);
            persist(q, e.target.value);
          }}
          className="rounded-lg border border-input bg-background p-2.5 text-sm"
        />
      );
    } else {
      const inputType =
        q.type === "number" || q.type === "currency"
          ? "number"
          : q.type === "date"
            ? "date"
            : "text";
      control = (
        <Input
          {...common}
          type={inputType}
          defaultValue={value == null ? "" : String(value)}
          onBlur={(e) => {
            setLocal(q.id, e.target.value);
            persist(q, e.target.value);
          }}
        />
      );
    }

    return (
      <div key={q.id} className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={q.id}>
            {q.label}
            {q.required ? <span className="text-destructive"> *</span> : null}
          </Label>
          <span className="text-xs text-muted-foreground">
            {st === "saving" ? "Saving…" : st === "saved" ? "Saved" : st === "error" ? "Error" : ""}
          </span>
        </div>
        {q.help ? <p className="text-xs text-muted-foreground">{q.help}</p> : null}
        {control}
        {err ? (
          <p role="alert" className="text-sm text-destructive">
            {err}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/90 py-2 backdrop-blur">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width: `${progress.requiredVisible ? (progress.requiredAnswered / progress.requiredVisible) * 100 : 0}%`,
            }}
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {progress.requiredAnswered}/{progress.requiredVisible} required
          {progress.complete ? " · complete" : ""}
        </span>
      </div>

      {GROUPS.map((group) => {
        const qs = visible.filter((q) => q.group === group.id && visibleIds.has(q.id));
        if (qs.length === 0) return null;
        return (
          <section key={group.id} className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{group.title}</h2>
              {group.description ? (
                <p className="text-sm text-muted-foreground">{group.description}</p>
              ) : null}
            </div>
            <div className="grid gap-5">{qs.map(renderField)}</div>
          </section>
        );
      })}
    </div>
  );
}
