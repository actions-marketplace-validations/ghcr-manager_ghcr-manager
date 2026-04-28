import { readFile } from "node:fs/promises";
import type { PackageSnapshot } from "./types.js";

export async function loadSnapshotFromFile(snapshotPath: string): Promise<PackageSnapshot> {
  const rawSnapshot = await readFile(snapshotPath, "utf8");
  return JSON.parse(rawSnapshot) as PackageSnapshot;
}
