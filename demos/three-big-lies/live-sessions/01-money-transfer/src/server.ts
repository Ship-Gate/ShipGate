/**
 * Simple server for the mobile banking app.
 * Serves the UI and /api/accounts from the in-memory Map.
 */

import { createServer } from "node:http";
import { getAllAccounts, transfer } from "./accounts.js";

const PORT = Number(process.env.PORT) || 3000;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <title>Mobile Banking</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(160deg, #0f172a 0%, #1e293b 100%);
      min-height: 100vh;
      color: #e2e8f0;
      padding: 1rem;
      padding-top: max(1rem, env(safe-area-inset-top));
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin: 0 0 1.25rem 0;
      color: #f8fafc;
    }
    .accounts {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .card {
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(71, 85, 105, 0.5);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .name { font-weight: 600; font-size: 1.1rem; }
    .id { font-size: 0.85rem; color: #94a3b8; margin-top: 0.15rem; }
    .balance {
      font-size: 1.25rem;
      font-weight: 700;
      color: #22c55e;
    }
    .balance.zero { color: #94a3b8; }
    .error { color: #f87171; margin-top: 1rem; }
  </style>
</head>
<body>
  <h1>Accounts</h1>
  <div class="accounts" id="accounts">Loading…</div>
  <script>
    fetch('/api/accounts')
      .then(r => r.json())
      .then(accounts => {
        const el = document.getElementById('accounts');
        if (!accounts.length) { el.innerHTML = '<p class="error">No accounts</p>'; return; }
        el.innerHTML = accounts.map(a => (
          '<div class="card">' +
            '<div><div class="name">' + escapeHtml(a.owner) + '</div><div class="id">' + escapeHtml(a.id) + '</div></div>' +
            '<div class="balance' + (a.balance === 0 ? ' zero' : '') + '">$' + formatAmount(a.balance) + '</div>' +
          '</div>'
        )).join('');
      })
      .catch(() => {
        document.getElementById('accounts').innerHTML = '<p class="error">Failed to load accounts</p>';
      });
    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }
    function formatAmount(n) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  </script>
</body>
</html>
`;

function serve(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse): void {
  const url = req.url ?? "/";
  if (url === "/" || url === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }
  if (url === "/api/accounts") {
    const accounts = getAllAccounts();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(accounts));
    return;
  }
  if (url === "/api/transfer" && req.method === "POST") {
    readJsonBody(req)
      .then((body) => {
        const fromId = typeof body?.fromId === "string" ? body.fromId : "";
        const toId = typeof body?.toId === "string" ? body.toId : "";
        const amount = typeof body?.amount === "number" ? body.amount : Number(body?.amount);
        if (!fromId || !toId || !Number.isFinite(amount)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Invalid body: need fromId, toId, amount" }));
          return;
        }
        const result = transfer(fromId, toId, amount);
        res.writeHead(result.success ? 200 : 400, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      })
      .catch(() => {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Invalid JSON" }));
      });
    return;
  }
  res.writeHead(404);
  res.end();
}

function readJsonBody(req: import("node:http").IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

createServer(serve).listen(PORT, () => {
  process.stdout.write(`Mobile banking app: http://localhost:${PORT}\n`);
});
