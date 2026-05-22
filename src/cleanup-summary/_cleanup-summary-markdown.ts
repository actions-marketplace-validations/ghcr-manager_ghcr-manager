import type { CleanupSummary, CleanupSummaryRoot } from "./_cleanup-summary.js";

const _DEFAULT_MAX_DIRECT_TARGET_TAGS = 100;
const _DEFAULT_MAX_ROOTS_PER_SECTION = 100;
const _DEFAULT_MAX_TAGS_PER_ROOT = 4;

export function renderCleanupSummaryMarkdown(
  summary: CleanupSummary,
  options: {
    maxDirectTargetTags?: number;
    maxRootsPerSection?: number;
    maxTagsPerRoot?: number;
  }
): string {
  const maxDirectTargetTags = options.maxDirectTargetTags ?? _DEFAULT_MAX_DIRECT_TARGET_TAGS;
  const maxRootsPerSection = options.maxRootsPerSection ?? _DEFAULT_MAX_ROOTS_PER_SECTION;
  const maxTagsPerRoot = options.maxTagsPerRoot ?? _DEFAULT_MAX_TAGS_PER_ROOT;
  const lines = [
    "## Cleanup Summary",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| 📦 Package | \`${_escapeInlineCode(`${summary.owner}/${summary.packageName}`)}\` |`,
    `| ⚙️ Mode | ${summary.dryRun ? "Cleanup dry-run" : "Cleanup"} |`,
    `| 🏷️ Selected tags | ${summary.directTargetTags.length} |`,
    `| 🔖 Planned tag removals | ${summary.plannedChanges.tagRemovals} |`,
    `| 🖼️ Planned image deletes | ${summary.plannedChanges.imageDeletes} |`,
    `| 📚 Planned cross-arch deletes | ${summary.plannedChanges.crossArchDeletes} |`,
    `| 📄 Planned item deletes | ${summary.plannedChanges.totalManifestDeletes} |`,
    `| 🔗 Tag-only updates | ${summary.untagOnlyRoots.length} |`,
    `| 🛡️ Blocked items | ${summary.blockedRoots.length} |`,
    ""
  ];

  lines.push(..._renderPlannedDeleteBreakdown(summary));
  lines.push(..._renderPlannerInputs(summary.plannerInputs));
  lines.push(..._renderDirectTargetTags(summary.directTargetTags, maxDirectTargetTags));
  lines.push(
    ..._renderRootSection("🗑️ Items to delete", summary.fullyDeletableRoots, maxRootsPerSection, maxTagsPerRoot)
  );
  lines.push(
    ..._renderRootSection("🔗 Tags to remove only", summary.untagOnlyRoots, maxRootsPerSection, maxTagsPerRoot)
  );
  lines.push(..._renderRootSection("🛡️ Blocked items", summary.blockedRoots, maxRootsPerSection, maxTagsPerRoot));

  if (!summary.dryRun && (summary.deletedPackageVersions.length > 0 || summary.untaggedTags.length > 0)) {
    lines.push(..._renderLiveEffects(summary));
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function _renderPlannedDeleteBreakdown(summary: CleanupSummary): string[] {
  if (
    summary.plannedChanges.signatureDeletes === 0 &&
    summary.plannedChanges.attestationDeletes === 0 &&
    summary.plannedChanges.artifactDeletes === 0
  ) {
    return [];
  }

  return [
    "<details>",
    "<summary>📦 Planned delete breakdown</summary>",
    "",
    "| Type | Count |",
    "| --- | --- |",
    `| Images | ${summary.plannedChanges.imageDeletes} |`,
    `| Cross-arch manifests | ${summary.plannedChanges.crossArchDeletes} |`,
    `| Signatures | ${summary.plannedChanges.signatureDeletes} |`,
    `| Attestations | ${summary.plannedChanges.attestationDeletes} |`,
    `| OCI artifacts | ${summary.plannedChanges.artifactDeletes} |`,
    "",
    "</details>",
    ""
  ];
}

function _renderPlannerInputs(plannerInputs: CleanupSummary["plannerInputs"]): string[] {
  const rows = _getPlannerInputRows(plannerInputs);

  return [
    "<details>",
    "<summary>⚙️ Cleanup filter</summary>",
    "",
    "| Filter | Value |",
    "| --- | --- |",
    ...(rows.length > 0 ? rows : ["| (none) | No cleanup filters recorded |"]),
    "",
    "</details>",
    ""
  ];
}

function _renderDirectTargetTags(tags: string[], maxDirectTargetTags: number): string[] {
  if (tags.length === 0) {
    return [];
  }

  const visibleTags = tags.slice(0, maxDirectTargetTags).map((tag) => `- \`${_escapeInlineCode(tag)}\``);
  const lines = ["<details>", "<summary>🏷️ Selected tags</summary>", "", ...visibleTags];
  if (tags.length > maxDirectTargetTags) {
    lines.push("", `_Showing first ${maxDirectTargetTags} of ${tags.length} selected tags._`);
  }
  lines.push("", "</details>", "");
  return lines;
}

function _renderRootSection(
  title: string,
  roots: CleanupSummaryRoot[],
  maxRootsPerSection: number,
  maxTagsPerRoot: number
): string[] {
  if (roots.length === 0) {
    return [];
  }

  const lines = ["<details>", `<summary>${title}</summary>`, ""];
  lines.push("| Version | Type | Digest | Tags | Outcome |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const root of roots.slice(0, maxRootsPerSection)) {
    lines.push(
      `| ${root.versionId} | ${_escapeMarkdown(_describeManifestKind(root.manifestKind))} | \`${_escapeInlineCode(_shortDigest(root.digest))}\` | ${_escapeMarkdown(_formatTags(root, maxTagsPerRoot))} | ${_escapeMarkdown(_formatReason(root))} |`
    );
  }

  if (roots.length > maxRootsPerSection) {
    lines.push("", `_Showing first ${maxRootsPerSection} of ${roots.length} ${title.toLowerCase()}._`);
  }

  lines.push("", "</details>", "");
  return lines;
}

function _renderLiveEffects(summary: CleanupSummary): string[] {
  const lines = ["### Applied changes", ""];
  lines.push(`- Deleted package versions: ${summary.deletedPackageVersions.length}`);
  lines.push(`- Detached tags: ${summary.untaggedTags.length}`);
  if (summary.unsupportedUntagRoots.length > 0) {
    lines.push(`- Unsupported untag roots: ${summary.unsupportedUntagRoots.length}`);
  }
  lines.push("");
  return lines;
}

function _formatTags(root: CleanupSummaryRoot, maxTagsPerRoot: number): string {
  const tags = root.rootTags.length > 0 ? root.rootTags : root.matchedTags;
  if (tags.length === 0) {
    return "(untagged)";
  }

  const visible = tags.slice(0, maxTagsPerRoot);
  const suffix = tags.length > maxTagsPerRoot ? `, +${tags.length - maxTagsPerRoot} more` : "";
  return visible.join(", ") + suffix;
}

function _formatReason(root: CleanupSummaryRoot): string {
  if (root.validationStatus === "blocked") {
    const blocking = root.blockingDigest ? _shortDigest(root.blockingDigest) : "another item";
    const overlap = root.overlapDigest ? ` via ${_shortDigest(root.overlapDigest)}` : "";
    return `Blocked by retained item ${blocking}${overlap}`;
  }

  if (root.validationStatus === "untag-only") {
    return "Remove selected tags, keep this item";
  }

  return "Delete this item and its descendants";
}

function _shortDigest(value: string): string {
  if (!value.startsWith("sha256:") || value.length <= 20) {
    return value;
  }

  return `${value.slice(0, 15)}...${value.slice(-8)}`;
}

function _escapeInlineCode(value: string): string {
  return value.replaceAll("`", "\\`");
}

function _escapeMarkdown(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function _getPlannerInputRows(plannerInputs: CleanupSummary["plannerInputs"]): string[] {
  const rows: string[] = [];

  for (const [key, value] of Object.entries(plannerInputs)) {
    rows.push(`| ${_escapeMarkdown(_plannerInputLabel(key))} | ${_escapeMarkdown(_formatPlannerInputValue(value))} |`);
  }

  return rows;
}

function _plannerInputLabel(key: string): string {
  switch (key) {
    case "deleteTags":
      return "Delete tags";
    case "excludeTags":
      return "Exclude tags";
    case "useRegex":
      return "Use regex";
    case "deleteUntagged":
      return "Delete untagged";
    case "keepNTagged":
      return "Keep newest tagged";
    case "keepNUntagged":
      return "Keep newest untagged";
    case "olderThan":
      return "Older than";
    case "cutoffTimestamp":
      return "Cutoff timestamp";
    case "deleteGhostImages":
      return "Delete ghost images";
    case "deletePartialImages":
      return "Delete partial images";
    case "deleteOrphanedImages":
      return "Delete orphaned images";
    default:
      return key;
  }
}

function _formatPlannerInputValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "(none)";
  }

  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }

  return String(value);
}

function _describeManifestKind(manifestKind?: string): string {
  switch (manifestKind) {
    case "image_manifest":
      return "image";
    case "image_index":
      return "cross-arch";
    case "signature_manifest":
      return "signature";
    case "attestation_manifest":
      return "attestation";
    case "artifact_manifest":
      return "artifact";
    default:
      return "item";
  }
}
