import express from 'express';
import { buildQuery } from './utils';

const app = express();
const API_KEY = "sk_live_1234567890abcdef1234567890abcdef";

app.post('/api/users', (req, res) => {
  const userId = req.body.id;
  db.query("SELECT * FROM users WHERE id=" + userId);
  res.send("<div>" + req.body.name + "</div>");
});

app.get('/api/search', (req, res) => {
  const query = buildQuery("users", "name", req.query.q as string);
  db.query(query);
  return res.json({ success: true, data: null });
});

app.get('/api/admin', (req, res) => {
  res.json({ users: [{ id: 1, name: 'placeholder' }] });
});

export default app;
