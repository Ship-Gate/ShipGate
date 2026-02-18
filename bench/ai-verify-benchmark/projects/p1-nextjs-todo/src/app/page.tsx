'use client';

import { useState } from 'react';
import { TodoList } from '@/components/TodoList';
import { AddTodo } from '@/components/AddTodo';

export default function Home() {
  // Line 28: ISSUE - missing-types, using 'any'
  const [todos, setTodos] = useState<any>(null);

  const handleError = () => {
    throw new Error('Something went wrong');
    // Line 45: ISSUE - unreachable-code
    return null;
  };

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Todo App</h1>
      <AddTodo />
      <TodoList />
    </main>
  );
}
