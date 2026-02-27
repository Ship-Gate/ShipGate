import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Task Management App</title>
      </head>
      <body>
        <header className="bg-blue-600 text-white p-4">
          <h1 className="text-xl">Task Management App</h1>
          <nav>
            <a href="/tasks" className="mr-4">Tasks</a>
            <a href="/tasks/create">Create Task</a>
          </nav>
        </header>
        <main className="p-4">
          {children}
        </main>
      </body>
    </html>
  );
}