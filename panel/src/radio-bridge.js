import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { pool } from "./db.js";

// Only explicitly shared stations are visible to TeamSpeak users.
export function radioBridge({ query = (...args) => pool.query(...args), secret = () => process.env.PANEL_RADIO_SECRET || "" } = {}) {
  const router = Router();
  router.get("/internal/radio", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const expected = Buffer.from(secret());
    const authorization = req.get("authorization") || "";
    const provided = Buffer.from(authorization.startsWith("Bearer ") ? authorization.slice(7) : "");
    if (expected.length < 32 || expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      if (typeof req.query.name === "string") {
        const name = req.query.name.trim();
        if (!name || name.length > 120) return res.status(400).json({ error: "Invalid name" });
        const [rows] = await query("SELECT name, url FROM radio_streams WHERE shared = 1 AND BINARY name = BINARY ? ORDER BY id LIMIT 2", [name]);
        if (rows.length === 0) return res.json({ status: "not_found" });
        if (rows.length > 1) return res.json({ status: "ambiguous" });
        return res.json({ status: "ok", name: rows[0].name, url: rows[0].url });
      }
      const page = Number(req.query.page || 1);
      if (!Number.isInteger(page) || page < 1 || page > 10000) return res.status(400).json({ error: "Invalid page" });
      const [[count]] = await query("SELECT COUNT(*) AS total FROM radio_streams WHERE shared = 1");
      const [rows] = await query("SELECT name FROM radio_streams WHERE shared = 1 ORDER BY name, id LIMIT 10 OFFSET ?", [(page - 1) * 10]);
      return res.json({ total: Number(count.total), stations: rows });
    } catch (err) { return next(err); }
  });
  return router;
}
