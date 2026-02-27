import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Task Management App',
  description: 'Manage your tasks efficiently',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="bg-blue-600 text-white p-4">
          <nav className="container mx-auto flex justify-between">
            <span className="font-bold">Task Management</span>
            <div>
              <a href="/tasks" className="mr-4">Tasks</a>
              <a href="/tasks/create">Create Task</a>
            </div>
          </nav>
        </header>
        <main className="container mx-auto mt-4">
          {children}
        </main>
      </body>
    </html>
  );
}
