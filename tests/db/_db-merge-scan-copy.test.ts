import assert from "node:assert/strict";
import test from "node:test";
import { DbMergeScanCopy } from "../../src/db/_db-merge-scan-copy.js";
import { openDatabase } from "../../src/db/index.js";

test("db merge scan copy quotes database paths for attach statements", () => {
  const database = openDatabase(":memory:");
  const helper = new DbMergeScanCopy(database);

  assert.equal(helper.quoteDatabasePath("/tmp/that's.sqlite"), "'/tmp/that''s.sqlite'");

  database.close();
});
