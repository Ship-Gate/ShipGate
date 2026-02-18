let todos: any[] = [];

export function getTodosFromMemory() {
  return todos;
}

export function addTodoToMemory(todo: any) {
  todos.push(todo);
}

// Line 12: ISSUE - dead-code, initializeDB is never called
export function initializeDB() {
  todos = [];
  console.log('Database initialized');
}
