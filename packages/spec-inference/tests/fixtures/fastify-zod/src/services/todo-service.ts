export async function createTodo(input: { title: string; description?: string }) {
  return { id: '1', ...input, completed: false };
}

export async function getTodo(id: string) {
  return { id, title: 'Todo', completed: false };
}

export async function updateTodo(id: string, input: { title?: string; completed?: boolean }) {
  return { id, ...input };
}

export async function deleteTodo(id: string) {
  return true;
}
