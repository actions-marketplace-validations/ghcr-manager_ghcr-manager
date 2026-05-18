#!/usr/bin/env node
/* global console, process */

import Database from "better-sqlite3";

const dbPath = process.argv[2];

if (!dbPath) {
  console.error("Usage: tools/db-has-non-public-scans.mjs <db-path>");
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });
const row = db.prepare("SELECT EXISTS(SELECT 1 FROM package_scans WHERE is_public = 0) AS has_non_public_scan").get();
db.close();

process.stdout.write(row.has_non_public_scan === 1 ? "true" : "false");
