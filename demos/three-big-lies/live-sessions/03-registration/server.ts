#!/usr/bin/env npx tsx
/**
 * "Production" server - simulates deploy.
 * Run: pnpm dev or pnpm deploy
 * Open http://localhost:3113
 */
import { createServer } from 'http';
import { registerUser, getUser } from './src/register.js';

const PORT = 3113;

const server = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200);
    res.end(`<!DOCTYPE html>
<html>
<head><title>Registration</title></head>
<body style="font-family:sans-serif;max-width:400px;margin:40px auto;padding:20px">
  <h1>Register</h1>
  <form method="POST" action="/register">
    <p><label>Email: <input name="email" type="text" /></label></p>
    <p><label>Name: <input name="name" type="text" /></label></p>
    <button type="submit">Register</button>
  </form>
  <p style="color:#666;font-size:14px">Try: empty email, or name = <code>'; DROP TABLE users--</code></p>
</body>
</html>`);
    return;
  }

  if (url.pathname === '/register' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const params = new URLSearchParams(body);
    const email = params.get('email') ?? '';
    const name = params.get('name') ?? '';
    const result = registerUser(email, name);
    res.writeHead(200);
    res.end(`<!DOCTYPE html>
<html>
<head><title>Registered</title></head>
<body style="font-family:sans-serif;max-width:400px;margin:40px auto;padding:20px">
  <h1>Registered!</h1>
  <p>User ID: <code>${result.id}</code></p>
  <p>Email: <code>${email || '(empty!)'}</code></p>
  <p>Name: <code>${name || '(empty!)'}</code></p>
  <p><a href="/">Back</a></p>
</body>
</html>`);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  App running at http://localhost:${PORT}`);
  console.log(`  Try registering with empty email - it "works"!\n`);
});
