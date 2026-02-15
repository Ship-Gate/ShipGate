'use client';

import { useEffect, useState } from 'react';

export default function TaskListPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTasks() {
      const response = await fetch('/api/v1/tasks');
      const data = await response.json();
      setTasks(data);
      setLoading(false);
    }
    fetchTasks();
  }, []);

  if (loading) return <p>Loading tasks...</p>;
  if (tasks.length === 0) return <p>No tasks available.</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Tasks</h1>
      <div className="grid grid-cols-1 gap-4">
        {tasks.map(task => (
          <div key={task.id} className="p-4 border rounded-lg shadow-sm">
            <h3 className="font-semibold">{task.title}</h3>
            <span className="text-sm text-gray-500">{task.status}</span>
          </div>
        ))}
      </div>
      <a href="/tasks/create" className="mt-4 inline-block bg-blue-600 text-white p-2 rounded">Create New Task</a>
    </div>
  );
}
