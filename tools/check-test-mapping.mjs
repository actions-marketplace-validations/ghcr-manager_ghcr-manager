import { access, readdir } from "node:fs/promises";
import path from "node:path";

const srcRoot = path.resolve("src");
const testsRoot = path.resolve("tests");
const violations = [];

await walk(srcRoot);

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(violation);
  }
  process.exitCode = 1;
}

async function walk(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      await walk(entryPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue;
    }

    const relativePath = path.relative(srcRoot, entryPath);
    const expectedTestPath = path.join(testsRoot, relativePath.replace(/\.ts$/, ".test.ts"));

    try {
      await access(expectedTestPath);
    } catch {
      violations.push(`Missing mapped test file: ${path.relative(process.cwd(), expectedTestPath)}`);
    }
  }
}
