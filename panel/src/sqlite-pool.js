import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const now = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

export function sqliteSql(sql) {
  return sql
    .replace(/CURRENT_TIMESTAMP\(3\)\s*-\s*INTERVAL\s*\?\s+SECOND/gi, "strftime('%Y-%m-%dT%H:%M:%fZ','now', '-' || ? || ' seconds')")
    .replace(/CURRENT_TIMESTAMP\(3\)\s*-\s*INTERVAL\s+1\s+DAY/gi, "strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')")
    .replace(/CURRENT_TIMESTAMP\(3\)/gi, now)
    .replace(/\s+FOR UPDATE\b/gi, "")
    .replace(/BINARY name = BINARY \?/gi, "name = ? COLLATE BINARY");
}

export function createSqlitePool(filename) {
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;");
  let tail = Promise.resolve();
  function lock() {
    let release;
    const next = new Promise((resolve) => { release = resolve; });
    const wait = tail;
    tail = next;
    return wait.then(() => release);
  }
  function run(sql, values = []) {
    const text = sqliteSql(sql);
    const args = values.map((v) => v instanceof Date ? v.toISOString() : v === undefined ? null : v);
    try {
      const statement = db.prepare(text);
      if (/^\s*(SELECT|PRAGMA|WITH)\b/i.test(text)) return [statement.all(...args).map((r) => ({ ...r }))];
      const result = statement.run(...args);
      return [{ affectedRows: Number(result.changes), insertId: Number(result.lastInsertRowid) }];
    } catch (err) {
      if (/UNIQUE constraint failed/i.test(err.message)) err.code = "ER_DUP_ENTRY";
      throw err;
    }
  }
  return {
    async query(sql, args) { const unlock = await lock(); try { return run(sql, args); } finally { unlock(); } },
    async getConnection() {
      const unlock = await lock();
      let released = false;
      return {
        async beginTransaction() { db.exec("BEGIN IMMEDIATE"); },
        async query(sql, args) { return run(sql, args); },
        async commit() { db.exec("COMMIT"); },
        async rollback() { if (db.isTransaction) db.exec("ROLLBACK"); },
        release() { if (!released) { released = true; unlock(); } },
      };
    },
    async migrate() {
      const version = db.prepare("PRAGMA user_version").get().user_version;
      if (version > 1) throw new Error("SQLite database is newer than this panel.");
      if (version === 0) {
        db.exec("BEGIN IMMEDIATE");
        try { db.exec(readFileSync(new URL("../sql/sqlite.sql", import.meta.url), "utf8")); db.exec("PRAGMA user_version=1; COMMIT"); }
        catch (err) { db.exec("ROLLBACK"); throw err; }
      }
    },
    async end() { db.close(); },
  };
}
