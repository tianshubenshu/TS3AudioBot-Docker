const base = "http://127.0.0.1:8080";
const login = await fetch(`${base}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: process.env.ADMIN_PASSWORD }) });
if (!login.ok) throw new Error(`Login failed: ${login.status}`);
const cookie = login.headers.get("set-cookie").split(";")[0];
const { csrf } = await login.json();
const roster = await fetch(`${base}/api/bots?status=0`, { headers: { cookie } });
const bots = (await roster.json()).bots;
if (!roster.ok || !bots?.length) throw new Error("Local bot was not registered");
const id = bots[0].id;
const list = await fetch(`${base}/api/bots/${id}/streams`, { headers: { cookie } });
const streams = (await list.json()).streams;
if (!streams.some((stream) => stream.name === "CI radio")) {
  const add = await fetch(`${base}/api/bots/${id}/streams`, { method: "POST", headers: { cookie, "content-type": "application/json", "x-csrf-token": csrf }, body: JSON.stringify({ name: "CI radio", url: "https://example.com/radio", shared: true }) });
  if (!add.ok) throw new Error(`Could not save radio: ${add.status}`);
}
let found = false;
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    const result = await fetch("http://127.0.0.1:58913/api/bot/template/default/(/%E5%88%97%E5%87%BA%E7%94%B5%E5%8F%B0)");
    if (result.ok && (await result.text()).includes("CI radio")) { found = true; break; }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!found) throw new Error("Bot could not list the radio");
console.log("Single-container login, SQLite radio and Chinese command passed.");
