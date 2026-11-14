import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import { radioBridge } from "../src/radio-bridge.js";

const token = "a".repeat(64);
const queries = [];
const query = async (sql, params) => {
  queries.push({ sql, params });
  if (sql.includes("COUNT")) return [[{ total: 11 }]];
  if (sql.includes("BINARY name")) {
    if (params[0] === "重名") return [[{ name: "重名" }, { name: "重名" }]];
    if (params[0] === "音乐") return [[{ name: "音乐", url: "https://example.com/stream" }]];
    return [[]];
  }
  return [[{ name: "音乐" }]];
};
let server, base;
before(async () => {
  const app = express();
  app.use(radioBridge({ secret: () => token, query }));
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}/internal/radio`;
});
after(() => server.close());
const get = (suffix, secret = token) => fetch(base + suffix, { headers: { authorization: `Bearer ${secret}` } });

test("radio bridge requires a secret and does not query for unauthorized callers", async () => {
  const before = queries.length;
  assert.equal((await get("", "b".repeat(64))).status, 401);
  assert.equal((await fetch(base, { headers: { authorization: token } })).status, 401);
  assert.equal(queries.length, before);
});

test("radio bridge lists shared names without URLs and paginates", async () => {
  const response = await get("?page=2");
  assert.deepEqual(await response.json(), { total: 11, stations: [{ name: "音乐" }] });
  assert.match(queries.at(-1).sql, /shared = 1/);
  assert.deepEqual(queries.at(-1).params, [10]);
  assert.equal((await get("?page=0")).status, 400);
});

test("radio bridge resolves exact shared names and rejects ambiguous ones", async () => {
  assert.deepEqual(await (await get("?name=" + encodeURIComponent("音乐"))).json(), { status: "ok", name: "音乐", url: "https://example.com/stream" });
  assert.match(queries.at(-1).sql, /shared = 1/);
  assert.deepEqual(await (await get("?name=" + encodeURIComponent("重名"))).json(), { status: "ambiguous" });
  assert.deepEqual(await (await get("?name=missing")).json(), { status: "not_found" });
});
