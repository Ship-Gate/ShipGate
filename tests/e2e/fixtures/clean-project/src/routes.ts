import express from 'express';
import { escapeHtml, requireAuth } from './utils';

const app = express();
const API_KEY = process.env.API_KEY;

app.post('/api/users', requireAuth, (req, res) => {
  const userId = req.body.id;
  db.query("SELECT * FROM users WHERE id=$1", [userId]);
  res.send(escapeHtml(req.body.name));
});

app.get('/api/search', requireAuth, (req, res) => {
  db.query("SELECT * FROM users WHERE name=$1", [req.query.q]);
  res.json({ users: [], total: 0 });
});

export default app;
