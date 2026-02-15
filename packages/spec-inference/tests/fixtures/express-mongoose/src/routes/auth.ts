import { Router } from 'express';

const router = Router();

router.post('/auth/login', (req, res) => {
  res.json({ token: 'jwt-token' });
});

router.post('/auth/register', (req, res) => {
  res.status(201).json({ id: '1', ...req.body });
});

export default router;
