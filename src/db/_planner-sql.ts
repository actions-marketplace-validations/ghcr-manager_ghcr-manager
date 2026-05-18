import type Database from "better-sqlite3";
import { silentPlannerLogger, type PlannerLogger } from "./_planner-types.js";

export class PlannerSql {
  readonly #database: Database.Database;
  readonly #logger: PlannerLogger;

  constructor(database: Database.Database, logger: PlannerLogger = silentPlannerLogger) {
    this.#database = database;
    this.#logger = logger;
  }

  get database(): Database.Database {
    return this.#database;
  }

  get logger(): PlannerLogger {
    return this.#logger;
  }

  exec(sql: string, params: Array<number | string | null> = []): void {
    this.#traceSql(sql, params);
    this.#database.prepare(sql).run(...params);
  }

  get<T>(sql: string, params: Array<number | string>): T | undefined {
    this.#traceSql(sql, params);
    return this.#database.prepare(sql).get(...params) as T | undefined;
  }

  all<T>(sql: string, params: Array<number | string>): T[] {
    this.#traceSql(sql, params);
    const rows = this.#database.prepare(sql).all(...params) as T[];
    this.#logger.debug(`SQL returned ${rows.length} row(s)`);
    return rows;
  }

  traceSql(sql: string, params: Array<number | string | null>): void {
    this.#traceSql(sql, params);
  }

  #traceSql(sql: string, params: Array<number | string | null>): void {
    this.#logger.trace(`SQL:\n${sql.trim()}\nPARAMS: ${JSON.stringify(params)}`);
  }
}
