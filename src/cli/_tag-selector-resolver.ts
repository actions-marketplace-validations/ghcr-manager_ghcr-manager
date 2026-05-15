import type Database from "better-sqlite3";
import type { PlanCommandInputs } from "./_planner-options.js";

export function resolveTagSelectors(database: Database.Database, inputs: PlanCommandInputs): PlanCommandInputs {
  if (inputs.deleteTags.length === 0 && inputs.excludeTags.length === 0) {
    return inputs;
  }

  const availableTags = _listLatestPackageTags(database, inputs.owner, inputs.packageName);
  return {
    ...inputs,
    deleteTags: _resolveSelectors(availableTags, inputs.deleteTags, inputs.useRegex),
    excludeTags: _resolveSelectors(availableTags, inputs.excludeTags, inputs.useRegex)
  };
}

function _listLatestPackageTags(database: Database.Database, owner: string, packageName: string): string[] {
  const rows = database
    .prepare(
      `
        SELECT t.tag
        FROM tags t
        INNER JOIN v_latest_scan_per_package latest_scan ON latest_scan.scan_id = t.scan_id
        WHERE latest_scan.owner = ?
          AND latest_scan.package_name = ?
        ORDER BY t.tag
      `
    )
    .all(owner, packageName) as Array<{ tag: string }>;
  return rows.map((row) => row.tag);
}

function _resolveSelectors(availableTags: string[], selectors: string[], useRegex: boolean): string[] {
  const resolved = new Set<string>();
  for (const selector of selectors) {
    const matcher = useRegex ? _buildRegexMatcher(selector) : _buildWildcardMatcher(selector);
    for (const tag of availableTags) {
      if (matcher(tag)) {
        resolved.add(tag);
      }
    }
  }
  return [...resolved];
}

function _buildRegexMatcher(selector: string): (tag: string) => boolean {
  const pattern = new RegExp(selector);
  return (tag) => pattern.test(tag);
}

function _buildWildcardMatcher(selector: string): (tag: string) => boolean {
  const escaped = selector
    .replaceAll(/[|\\{}()[\]^$+.]/g, "\\$&")
    .replaceAll("*", ".*")
    .replaceAll("?", ".");
  const pattern = new RegExp(`^${escaped}$`);
  return (tag) => pattern.test(tag);
}
