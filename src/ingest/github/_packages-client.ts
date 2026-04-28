import type { PackageVersionRecord, TagRecord } from "../../core/index.js";
import type { FetchLike, GitHubScanOptions } from "./_shared.js";

interface _GitHubPackageVersion {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  metadata?: {
    container?: {
      tags?: string[];
    };
  };
}

export async function loadPackageVersions(
  fetchImpl: FetchLike,
  githubApiBaseUrl: string,
  options: GitHubScanOptions,
): Promise<PackageVersionRecord[]> {
  const versions: PackageVersionRecord[] = [];

  for (let page = 1; ; page += 1) {
    const url = new URL(
      `/orgs/${encodeURIComponent(options.owner)}/packages/container/${encodeURIComponent(options.packageName)}/versions`,
      githubApiBaseUrl,
    );
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const response = await fetchImpl(url.toString(), {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${options.token}`,
        "User-Agent": "ghcr-manager",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) {
      throw new Error(`GitHub Packages request failed with status ${response.status}`);
    }

    const pageData = (await response.json()) as _GitHubPackageVersion[];
    if (pageData.length === 0) {
      break;
    }

    for (const version of pageData) {
      versions.push({
        versionId: version.id,
        digest: version.name,
        createdAt: version.created_at,
        updatedAt: version.updated_at,
        metadata: version.metadata as Record<string, unknown> | undefined,
      });
    }

    if (pageData.length < 100) {
      break;
    }
  }

  return versions.sort((left, right) => left.versionId - right.versionId);
}

export function buildTags(packageVersions: PackageVersionRecord[]): TagRecord[] {
  const tags: TagRecord[] = [];

  for (const version of packageVersions) {
    const metadata = version.metadata?.container;
    const tagNames = Array.isArray((metadata as { tags?: unknown } | undefined)?.tags)
      ? ((metadata as { tags: unknown[] }).tags.filter((tag): tag is string => typeof tag === "string") as string[])
      : [];

    for (const tagName of tagNames) {
      tags.push({
        tag: tagName,
        digest: version.digest,
        versionId: version.versionId,
      });
    }
  }

  return tags.sort((left, right) => left.tag.localeCompare(right.tag));
}
