import { NextResponse } from "next/server";

import { getGroq, getModels } from "@/lib/groq";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckStatus = "ok" | "error";
type Check = {
  status: CheckStatus;
  detail: string;
  meta?: Record<string, unknown>;
};

const TIMEOUT_MS = 8000;

async function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS),
    ),
  ]);
}

function toCheck(
  result: PromiseSettledResult<Check>,
  fallbackDetail: string,
): Check {
  if (result.status === "fulfilled") return result.value;
  const reason = result.reason;
  return {
    status: "error",
    detail: reason instanceof Error ? reason.message : fallbackDetail,
  };
}

/** DB connectivity + corpus row counts via a direct connection-level probe. */
async function checkDatabaseAndCorpus(): Promise<{ database: Check; corpus: Check }> {
  const sql = getSql();
  const rows = await withTimeout(
    sql<{ documents: number; chunks: number }[]>`
      select
        (select count(*)::int from public.corpus_documents) as documents,
        (select count(*)::int from public.corpus_chunks)    as chunks`,
    "database",
  );
  const { documents, chunks } = rows[0];
  return {
    database: { status: "ok", detail: "connected" },
    corpus: {
      status: "ok",
      detail: `${chunks} chunk(s) across ${documents} document(s)`,
      meta: { documents, chunks },
    },
  };
}

/** Live, non-secret Groq ping via the models endpoint (no token spend). */
async function checkGroq(): Promise<Check> {
  const client = getGroq();
  const { drafting, reasoning } = getModels();
  const models = await withTimeout(client.models.list(), "groq");
  return {
    status: "ok",
    detail: "reachable",
    meta: {
      configured_models: { drafting, reasoning },
      available_count: models.data.length,
    },
  };
}

export async function GET() {
  const [dbCorpus, groq] = await Promise.allSettled([
    checkDatabaseAndCorpus(),
    checkGroq(),
  ]);

  let database: Check;
  let corpus: Check;
  if (dbCorpus.status === "fulfilled") {
    database = dbCorpus.value.database;
    corpus = dbCorpus.value.corpus;
  } else {
    const detail =
      dbCorpus.reason instanceof Error ? dbCorpus.reason.message : "database unavailable";
    database = { status: "error", detail };
    corpus = { status: "error", detail: "unavailable (database down)" };
  }

  const checks = {
    database,
    corpus,
    groq: toCheck(groq, "groq unavailable"),
  };

  const healthy = Object.values(checks).every((c) => c.status === "ok");

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  );
}
