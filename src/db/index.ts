import Database from "better-sqlite3";
import { initializeSchema } from "./_schema.js";

export { SnapshotRepository } from "./_snapshot-repository.js";

export function openDatabase(databasePath: string): Database.Database {
  const database = new Database(databasePath);
  initializeSchema(database);
  return database;
}
