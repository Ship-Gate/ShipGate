import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold">Tasks</h2>
        <p className="mt-2">Manage your tasks efficiently.</p>
        <Link href="/tasks" className="mt-4 inline-block text-blue-600">View Tasks</Link>
      </div>
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold">Create Task</h2>
        <p className="mt-2">Add a new task to your list.</p>
        <Link href="/tasks/create" className="mt-4 inline-block text-blue-600">Create Task</Link>
      </div>
    </div>
  );
}
