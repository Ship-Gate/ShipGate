// Simulated AI-generated implementation
export interface Task {
  id: string;
  title: string;
  completed: boolean;
}

const tasks = new Map<string, Task>();

export function createTask(title: string): Task {
  const id = crypto.randomUUID();
  const task: Task = { id, title, completed: false };
  tasks.set(id, task);
  return task;
}

export function getTask(id: string): Task | undefined {
  return tasks.get(id);
}
