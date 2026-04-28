import { SnapshotRepository, openDatabase } from "../db/index.js";
import { loadSnapshotFromFile } from "../ingest/file/index.js";
import { loadSnapshotFromGitHub } from "../ingest/github/index.js";
import { findOption, requireOption, resolveGitHubToken } from "./_args.js";

export async function handleScan(args: string[]): Promise<number> {
  const databasePath = requireOption(args, "--db");
  const database = openDatabase(databasePath);
  const repository = new SnapshotRepository(database);
  const snapshot = await _loadSnapshot(args);

  repository.replaceSnapshot(snapshot);
  console.log(
    JSON.stringify(
      {
        packageName: snapshot.packageName,
        scannedAt: snapshot.scannedAt,
        packageVersions: snapshot.packageVersions.length,
        tags: snapshot.tags.length,
        manifests: snapshot.manifests.length,
        manifestEdges: snapshot.manifestEdges.length,
      },
      null,
      2,
    ),
  );

  database.close();
  return 0;
}

async function _loadSnapshot(args: string[]) {
  const source = findOption(args, "--source") ?? "file";
  switch (source) {
    case "file":
      return loadSnapshotFromFile(requireOption(args, "--snapshot"));
    case "github":
      return loadSnapshotFromGitHub({
        owner: requireOption(args, "--owner"),
        packageName: requireOption(args, "--package"),
        token: resolveGitHubToken(args),
      });
    default:
      throw new Error(`unknown scan source: ${source}`);
  }
}
