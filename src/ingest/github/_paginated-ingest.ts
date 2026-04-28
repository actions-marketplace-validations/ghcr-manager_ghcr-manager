import type { GitHubScanLogger } from "./_shared.js";

export interface PaginatedIngestOptions<T> {
  loadPage(page: number): Promise<T[]>;
  writePage(pageItems: T[], page: number): Promise<void> | void;
  logger?: GitHubScanLogger;
  progressLabel: string;
  pageSize?: number;
  progressIntervalPages?: number;
}

export interface PaginatedIngestResult {
  pages: number;
  items: number;
}

export async function ingestPaginated<T>(options: PaginatedIngestOptions<T>): Promise<PaginatedIngestResult> {
  const pageSize = options.pageSize ?? 100;
  const progressIntervalPages = options.progressIntervalPages ?? 10;
  let pages = 0;
  let items = 0;
  let lastLoggedPage = 0;

  for (let page = 1; ; page += 1) {
    const pageItems = await options.loadPage(page);
    if (pageItems.length === 0) {
      break;
    }

    await options.writePage(pageItems, page);
    pages = page;
    items += pageItems.length;

    if (page === 1 || page % progressIntervalPages === 0 || pageItems.length < pageSize) {
      options.logger?.info(`Loaded ${options.progressLabel} ${page} (${items} items total)`);
      lastLoggedPage = page;
    }

    if (pageItems.length < pageSize) {
      break;
    }
  }

  if (pages > 0 && lastLoggedPage !== pages) {
    options.logger?.info(`Loaded ${options.progressLabel} ${pages} (${items} items total)`);
  }

  return { pages, items };
}
