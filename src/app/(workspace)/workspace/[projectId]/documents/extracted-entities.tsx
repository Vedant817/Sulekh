"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { confirmEntityAction } from "./actions";

type Entity = {
  id: string;
  entity_type: string;
  data: unknown;
  corrected_data: unknown;
  source_snippet: string | null;
  confirmed_by_promoter: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  financial_line_item: "Financial line items",
  cap_table_row: "Capitalisation table",
  litigation_item: "Litigation",
  kmp_person: "Key management personnel",
  promoter: "Promoters",
};

function EntityRow({ projectId, entity }: { projectId: string; entity: Entity }) {
  const effective = entity.corrected_data ?? entity.data;
  const [confirmed, setConfirmed] = useState(entity.confirmed_by_promoter);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => JSON.stringify(effective, null, 2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(corrected?: unknown) {
    setBusy(true);
    setError(null);
    const res = await confirmEntityAction(projectId, entity.id, corrected);
    setBusy(false);
    if (res.ok) {
      setConfirmed(true);
      setEditing(false);
    } else {
      setError(res.error ?? "Could not save.");
    }
  }

  async function saveCorrection() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setError("Corrected value must be valid JSON.");
      return;
    }
    await confirm(parsed);
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words text-xs text-foreground">
          {JSON.stringify(effective, null, 2)}
        </pre>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            confirmed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {confirmed ? "Confirmed" : "Unconfirmed"}
        </span>
      </div>
      {entity.source_snippet ? (
        <p className="border-l-2 border-muted pl-2 text-xs italic text-muted-foreground">
          “{entity.source_snippet}”
        </p>
      ) : null}
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            className="rounded-lg border border-input bg-background p-2 font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={saveCorrection}>
              Save correction & confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" disabled={busy || confirmed} onClick={() => confirm()}>
            {confirmed ? "Confirmed" : busy ? "Saving…" : "Confirm"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Correct
          </Button>
        </div>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </li>
  );
}

export function ExtractedEntities({
  projectId,
  entities,
}: {
  projectId: string;
  entities: Entity[];
}) {
  if (entities.length === 0) return null;

  const grouped = new Map<string, Entity[]>();
  for (const e of entities) {
    const list = grouped.get(e.entity_type) ?? [];
    list.push(e);
    grouped.set(e.entity_type, list);
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Confirm extracted data</h2>
        <p className="text-sm text-muted-foreground">
          Review each value against its source. Only confirmed values are used to
          generate the draft — nothing is trusted blindly.
        </p>
      </div>
      {[...grouped.entries()].map(([type, list]) => (
        <div key={type} className="flex flex-col gap-2">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {TYPE_LABEL[type] ?? type} ({list.length})
          </h3>
          <ul className="flex flex-col gap-2">
            {list.map((e) => (
              <EntityRow key={e.id} projectId={projectId} entity={e} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
