#!/usr/bin/env node
import { argv } from "node:process";

const KNOWN_PROOFS = [
  "archive-membership",
  "consented-interview",
  "multipart-media-ingestion",
  "evidence-extraction",
  "timeline-disputes",
  "cited-memoir-draft",
  "book-pdf-epub",
  "authorized-narration",
  "private-family-portal",
  "portable-export",
  "verified-deletion",
  "rights-and-consent",
  "sensitive-claim-gate",
  "ai-cache-telemetry",
  "billing-and-quotas",
  "annual-preservation-review",
] as const;

function usage() {
  const lines = [
    "usage: run.ts --proof <name>",
    "usage: run.ts --list",
    "known proofs:",
    ...KNOWN_PROOFS.map((proof) => `  - ${proof}`),
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

function parseArgs(): { proof?: string; list: boolean } {
  const args = argv.slice(2);
  const list = args.includes("--list");
  if (list) return { list: true };

  const idx = args.indexOf("--proof");
  if (idx === -1 || !args[idx + 1]) return { list: false };
  return { proof: args[idx + 1], list: false };
}

function assertKnownProof(proof: string): proof is (typeof KNOWN_PROOFS)[number] {
  return (KNOWN_PROOFS as readonly string[]).includes(proof);
}

function runProof(proof: (typeof KNOWN_PROOFS)[number]): void {
  // Deferred until EP-007 supplies full proof implementations.
  throw new Error(`live-fire proof '${proof}' is not yet implemented`);
}

function main() {
  const { proof, list } = parseArgs();

  if (list) {
    usage();
    process.exit(0);
  }

  if (!proof || !assertKnownProof(proof)) {
    usage();
    process.exit(2);
  }

  try {
    runProof(proof);
    process.stdout.write(`live-fire: proof ${proof} passed\n`);
    process.exit(0);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.stderr.write(
      "live-fire: BLOCKED - proof implementation pending; no mock or synthetic success was executed\n",
    );
    process.exit(1);
  }
}

main();
