"use client";

import { useActionState, useEffect, useRef } from "react";

import { createProjectAction, type CreateProjectState } from "@/app/(workspace)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: CreateProjectState = { error: null };

export function CreateProjectForm() {
  const [state, formAction, pending] = useActionState(createProjectAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset the field after a successful create (revalidation refreshes the list).
  useEffect(() => {
    if (!pending && state.error === null) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-end"
    >
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="name">New IPO project</Label>
        <Input
          id="name"
          name="name"
          placeholder="e.g. Acme Manufacturing Ltd — BSE SME IPO"
          required
          minLength={2}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="targetBoard">Board</Label>
        <select
          id="targetBoard"
          name="targetBoard"
          defaultValue="BSE_SME"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="BSE_SME">BSE SME</option>
          <option value="NSE_EMERGE">NSE Emerge</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create project"}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive sm:self-center">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
