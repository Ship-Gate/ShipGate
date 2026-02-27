import express from 'express';
import { v4 as uuidv4 } from 'uuid';

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const app = express();
app.use(express.json());

const users: Map<string, User> = new Map();

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function userExists(email: string): boolean {
  return Array.from(users.values()).some(u => u.email === email);
}

app.post('/users', (req, res) => {
  const { email, name } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'INVALID_EMAIL' });
  }
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'NAME_REQUIRED' });
  }
  if (userExists(email)) {
    return res.status(409).json({ error: 'EMAIL_EXISTS' });
  }

  const now = new Date();
  const user: User = {
    id: uuidv4(),
    email,
    name,
    createdAt: now,
    updatedAt: now,
  };

  users.set(user.id, user);
  res.status(201).json(user);
});

app.get('/users/:id', (req, res) => {
  const { id } = req.params;
  const user = users.get(id);
  if (!user) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
  res.json(user);
});

app.put('/users/:id', (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;

  const user = users.get(id);
  if (!user) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }

  if (!name && !email) {
    return res.status(400).json({ error: 'At least one field required' });
  }

  if (email && email !== user.email && userExists(email)) {
    return res.status(409).json({ error: 'EMAIL_EXISTS' });
  }

  if (name) user.name = name;
  if (email) user.email = email;
  user.updatedAt = new Date();

  users.set(id, user);
  res.json(user);
});

app.delete('/users/:id', (req, res) => {
  const { id } = req.params;
  const user = users.get(id);
  if (!user) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
  users.delete(id);
  res.status(200).json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
