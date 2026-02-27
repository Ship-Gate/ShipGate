import Fastify from 'fastify';

const app = Fastify();

app.get('/api/todos', async () => {
  return { todos: [] };
});

app.post('/api/todos', async (request, reply) => {
  return reply.status(201).send({ id: '1', ...request.body });
});

app.get('/api/todos/:id', async (request) => {
  const { id } = request.params as { id: string };
  return { id, title: 'Todo' };
});

app.patch('/api/todos/:id', async (request) => {
  const { id } = request.params as { id: string };
  return { id, ...request.body };
});

app.delete('/api/todos/:id', async (request) => {
  const { id } = request.params as { id: string };
  return { deleted: id };
});

export default app;
