'use client';

import { useEffect, useState } from 'react';

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/tasks')
      .then((res) => res.json())
      .then((data) => {
        setTasks(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading...</p>;
  if (tasks.length === 0) return <p>No tasks available.</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Task List</h1>
      <a href="/tasks/create" className="bg-blue-500 text-white px-4 py-2 rounded">Create New Task</a>
      <div className="grid grid-cols-1 gap-4 mt-4">
        {tasks.map((task) => (
          <div key={task.id} className="p-4 border rounded-lg shadow-sm">
            <h3 className="font-semibold">{task.title}</h3>
            <span className="text-sm text-gray-500">{task.status}</span>
            <span className="text-sm text-gray-500">Priority: {task.priority}</span>
          </div>
        ))}
      </div>
    </div>
  );
}