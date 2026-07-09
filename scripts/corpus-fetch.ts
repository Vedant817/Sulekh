import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { CORPUS_DIR, loadManifest, sourcePath } from "../src/server/retrieval/corpus";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120 Safari/537.36";

async function download(url: string, dest: string): Promise<number> {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/pdf,*/*" },
    redirect: "follow",
  });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(dest));
  const { size } = await import("node:fs/promises").then((m) => m.stat(dest));
  return size;
}

async function main() {
  mkdirSync(CORPUS_DIR, { recursive: true });
  const { sources } = loadManifest();
  const force = process.argv.includes("--force");

  let fetched = 0;
  const failures: string[] = [];
  for (const source of sources) {
    const dest = sourcePath(source);
    if (existsSync(dest) && !force) {
      console.log(`• have   ${source.file}`);
      continue;
    }
    process.stdout.write(`• fetch  ${source.file} <- ${source.url} ... `);
    try {
      const bytes = await download(source.url, dest);
      console.log(`${(bytes / 1_000_000).toFixed(1)} MB`);
      fetched += 1;
    } catch (err) {
      console.log("FAILED");
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${source.file} (${source.url}): ${msg}${source.required ? " [required]" : ""}`);
    }
  }

  if (failures.length) {
    console.error(`\n✖ ${failures.length} source(s) failed to download:`);
    for (const f of failures) console.error(`  - ${f}`);
    if (failures.some((f) => f.includes("[required]"))) {
      console.error("\nRequired sources are missing. Place them manually in corpus/ or fix the URL.");
      process.exitCode = 1;
      return;
    }
  }
  console.log(`\n✔ Corpus fetch complete (${fetched} downloaded).`);
}

main().catch((err) => {
  console.error("✖ Corpus fetch failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
