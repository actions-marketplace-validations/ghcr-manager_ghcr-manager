#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { handleCleanup } from "./_cleanup-command.js";
import { handleScan } from "./_scan-command.js";

export async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (!command) {
    printUsage();
    return 1;
  }

  switch (command) {
    case "cleanup":
      return handleCleanup(rest);
    case "scan":
      return handleScan(rest);
    default:
      throw new Error(`unknown command: ${command}`);
  }
}

function printUsage(): void {
  console.error(`Usage:
  ghcr-manager cleanup --db <path> [--log-level <trace|debug|info|warn|error|silent>] [--dry-run] --owner <org> --package <name> [--token <token>] --delete-untagged [--older-than <interval>]
  ghcr-manager cleanup --db <path> [--log-level <trace|debug|info|warn|error|silent>] [--dry-run] --owner <org> --package <name> [--token <token>] --delete-ghost-images [--exclude-tag <tag> ...] [--use-regex] [--keep-n-tagged <count>] [--older-than <interval>]
  ghcr-manager cleanup --db <path> [--log-level <trace|debug|info|warn|error|silent>] [--dry-run] --owner <org> --package <name> [--token <token>] --delete-partial-images [--exclude-tag <tag> ...] [--use-regex] [--keep-n-tagged <count>] [--older-than <interval>]
  ghcr-manager cleanup --db <path> [--log-level <trace|debug|info|warn|error|silent>] [--dry-run] --owner <org> --package <name> [--token <token>] --delete-orphaned-images [--exclude-tag <tag> ...] [--use-regex] [--keep-n-tagged <count>] [--older-than <interval>]
  ghcr-manager cleanup --db <path> [--log-level <trace|debug|info|warn|error|silent>] [--dry-run] --owner <org> --package <name> [--token <token>] --keep-n-tagged <count> [--older-than <interval>]
  ghcr-manager cleanup --db <path> [--log-level <trace|debug|info|warn|error|silent>] [--dry-run] --owner <org> --package <name> [--token <token>] --keep-n-untagged <count> [--older-than <interval>]
  ghcr-manager cleanup --db <path> [--log-level <trace|debug|info|warn|error|silent>] [--dry-run] --owner <org> --package <name> [--token <token>] --delete-tag <tag> [--delete-tag <tag> ...] [--exclude-tag <tag> ...] [--use-regex] [--older-than <interval>]
  ghcr-manager scan --db <path> [--log-level <trace|debug|info|warn|error|silent>] [--github-output <path>] --owner <org> --package <name> --token <token>`);
}

const _entryPath = process.argv[1];
const _isDirectExecution = realpathSync(_entryPath) === realpathSync(fileURLToPath(import.meta.url));

if (_isDirectExecution) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
