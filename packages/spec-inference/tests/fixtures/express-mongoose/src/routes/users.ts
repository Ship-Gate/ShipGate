import { Router } from 'express';

const router = Router();

router.get('/users', (_req, res) => {
  res.json({ users: [] });
});

router.post('/users', (req, res) => {
  res.status(201).json({ id: '1', ...req.body });
});

router.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id });
});

router.put('/users/:id', (req, res) => {
  res.json({ id: req.params.id, ...req.body });
});

router.delete('/users/:id', (req, res) => {
  res.status(204).send();
});

export default router;
