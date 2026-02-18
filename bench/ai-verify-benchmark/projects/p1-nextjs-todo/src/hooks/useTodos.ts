import { useState, useEffect } from 'react';

export function useTodos() {
  const [todos, setTodos] = useState<any[]>([]);

  const updateTodo = async (id: string, updates: any) => {
    // Line 14: ISSUE - race-condition, concurrent updates can overwrite each other
    const response = await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    
    const updated = await response.json();
    setTodos(prev => prev.map(t => t.id === id ? updated : t));
  };

  return { todos, updateTodo };
}
