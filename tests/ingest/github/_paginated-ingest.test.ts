import assert from "node:assert/strict";
import test from "node:test";
import { ingestPaginated } from "../../../src/ingest/github/_paginated-ingest.js";

test("paginated ingest writes each page and reports progress", async () => {
  const writtenPages: number[] = [];
  const writtenItems: number[] = [];
  const progressMessages: string[] = [];

  const result = await ingestPaginated<number>({
    progressLabel: "test pages",
    progressIntervalPages: 2,
    logger: {
      debug() {},
      info(message) {
        progressMessages.push(message);
      },
      warn() {},
      error() {},
    },
    async loadPage(page) {
      if (page === 1) {
        return [1, 2];
      }
      if (page === 2) {
        return [3];
      }
      return [];
    },
    writePage(pageItems, page) {
      writtenPages.push(page);
      writtenItems.push(...pageItems);
    },
    pageSize: 2,
  });

  assert.deepEqual(writtenPages, [1, 2]);
  assert.deepEqual(writtenItems, [1, 2, 3]);
  assert.deepEqual(progressMessages, ["Loaded test pages 1 (2 items total)", "Loaded test pages 2 (3 items total)"]);
  assert.deepEqual(result, { pages: 2, items: 3 });
});
