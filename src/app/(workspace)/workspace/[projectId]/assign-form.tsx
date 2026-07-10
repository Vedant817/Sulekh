"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { assignIntermediaryAction } from "./review/actions";

export function AssignForm({
  projectId,
  assigned,
}: {
  projectId: string;
  assigned: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function assign() {
    setError(null);
    setOk(false);
    startTransition(async () => {
      const res = await assignIntermediaryAction(projectId, email);
      if (!res.ok) setError(res.error ?? "Assignment failed.");
      else {
        setOk(true);
        setEmail("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border p-4">
      <span className="text-sm font-medium">
        {assigned ? "Reassign authorised intermediary" : "Assign an authorised intermediary"}
      </span>
      <div className="flex gap-2">
        <Input
          type="email"
          value={email}
          placeholder="intermediary@firm.com"
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button onClick={assign} disabled={pending || email.trim().length === 0}>
          {pending ? "Assigning…" : "Assign"}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-600">Intermediary assigned.</p> : null}
    </div>
  );
}
