/**
 * Demo Server for Reality Probe
 * 
 * This server implements some routes but NOT /api/foo (ghost route)
 */

import express from 'express';

const app = express();
const PORT = 3000;

app.use(express.json());

// Real route: /api/users
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

// Real route: /health
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Ghost route: /api/foo is NOT implemented
// But the spec claims it exists - reality probe will detect this!

app.listen(PORT, () => {
  console.log(`Demo server running on http://localhost:${PORT}`);
  console.log('Available routes:');
  console.log('  GET /api/users');
  console.log('  GET /health');
  console.log('\nGhost route (claimed but not implemented):');
  console.log('  GET /api/foo');
});
