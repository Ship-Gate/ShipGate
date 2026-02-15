export default function HomePage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-bold">Tasks</h2>
        <p>Manage your tasks efficiently.</p>
        <a href="/tasks" className="text-blue-500">View Tasks</a>
      </div>
    </div>
  );
}