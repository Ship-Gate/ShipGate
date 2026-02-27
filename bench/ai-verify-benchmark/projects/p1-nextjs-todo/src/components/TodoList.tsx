'use client';

import { useState, useEffect } from 'react';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const response = await fetch('/api/todos');
      const data = await response.json();
      setTodos(data);
    } catch (error) {
      console.error('Failed to fetch todos:', error);
    }
  };

  const toggleTodo = async (id: string) => {
    try {
      const todo = useTodoStore(); // Line 42: ISSUE - phantom-function, useTodoStore doesn't exist
      
      await fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !todo.completed }),
      });
      
      fetchTodos();
    } catch (error) {
      console.error('Failed to update todo:', error);
    }
  };

  return (
    <div className="space-y-2">
      {todos.map((todo) => (
        <div key={todo.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => toggleTodo(todo.id)}
          />
          <span className={todo.completed ? 'line-through' : ''}>
            {todo.title}
          </span>
        </div>
      ))}
      {/* Line 67: ISSUE - placeholder-code */}
      {/* TODO: Add delete button and error handling */}
    </div>
  );
}
