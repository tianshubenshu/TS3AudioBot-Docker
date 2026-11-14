import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const directory = mkdtempSync(join(tmpdir(), "ts3panel-sqlite-"));
process.env.DATABASE_ENGINE = "sqlite";
process.env.SQLITE_PATH = join(directory, "panel.sqlite3");
process.env.ADMIN_PASSWORD = "test-password-123";
const db = await import("../src/db.js");
after(async () => { await db.pool.end(); rmSync(directory, { recursive: true, force: true }); });

test("SQLite stores accounts, sessions and shared radio across migrations", async () => {
  await db.migrate();
  assert.equal((await db.ensureAdmin()).created, true);
  assert.equal((await db.ensureAdmin()).created, false);
  const admin = await db.findUserByUsername("admin");
  await db.createSession({ id: "session", userId: admin.id, csrf: "csrf", expiresAt: db.newSessionExpiry() });
  assert.equal((await db.getSession("session")).username, "admin");
  await db.ensureSingleDefaults();
  await db.ensureSingleDefaults();
  const [instances] = await db.pool.query("SELECT id FROM instances");
  assert.equal(instances.length, 1);
  const instanceId = instances[0].id;
  const botId = await db.ensureTsBot(instanceId, "default", "default");
  assert.ok(botId > 0);
  const streamId = await db.insertStream({ name: "测试电台", url: "https://example.com/stream", shared: true, ownerUserId: admin.id });
  assert.equal((await db.getStream(streamId, { id: admin.id, role: "admin" })).name, "测试电台");
  const [found] = await db.pool.query("SELECT name, url FROM radio_streams WHERE shared = 1 AND BINARY name = BINARY ? ORDER BY id LIMIT 2", ["测试电台"]);
  assert.equal(found.length, 1);
  await assert.rejects(db.insertStream({ name: "重复", url: "https://example.com/stream", shared: true, ownerUserId: admin.id }), /already saved/);
  await db.migrate();
  assert.equal((await db.listStreams({ id: admin.id, role: "admin" })).length, 1);
  const { createSqlitePool } = await import("../src/sqlite-pool.js");
  const reopened = createSqlitePool(process.env.SQLITE_PATH);
  try { assert.equal((await reopened.query("SELECT COUNT(*) AS total FROM radio_streams"))[0][0].total, 1); }
  finally { await reopened.end(); }
});

test("SQLite serializes transactions and preserves invite use limits", async () => {
  const admin = await db.findUserByUsername("admin");
  const [instances] = await db.pool.query("SELECT id FROM instances LIMIT 1");
  await db.insertInvite({ tokenHash: "invite-hash", label: "test", createdByUserId: admin.id, expiresAt: null, maxUses: 1, canCreateBots: false, botLimit: null, instanceIds: [instances[0].id] });
  const results = await Promise.allSettled([
    db.registerWithInvite({ tokenHash: "invite-hash", username: "first", passwordHash: "hash" }),
    db.registerWithInvite({ tokenHash: "invite-hash", username: "second", passwordHash: "hash" }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
});

test("panel login and station creation work with SQLite", async () => {
  const { createApp } = await import("../src/app.js");
  const app = createApp();
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const login = await fetch(`${base}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: "test-password-123" }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const { csrf } = await login.json();
    const [bots] = await db.pool.query("SELECT id FROM ts_bots LIMIT 1");
    const add = await fetch(`${base}/api/bots/${bots[0].id}/streams`, {
      method: "POST", headers: { cookie, "content-type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ name: "面板测试", url: "https://example.org/radio", shared: true }),
    });
    assert.equal(add.status, 200, await add.text());
    const list = await fetch(`${base}/api/bots/${bots[0].id}/streams`, { headers: { cookie } });
    assert.equal(list.status, 200);
    assert.ok((await list.json()).streams.some((stream) => stream.name === "面板测试"));
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
