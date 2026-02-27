import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center">
        <img
          src="/logo.png"
          alt="ShipGate"
          className="w-16 h-16 rounded-[10px] mb-4"
        />
        <h1 className="text-2xl font-bold text-sg-text0 mb-4">ShipGate</h1>
        <p className="text-sg-text2 mb-8">The verification layer for AI-generated code</p>
        <Link
          href="/dashboard"
          className="inline-block px-6 py-3 rounded-lg bg-sg-ship text-sg-bg0 font-semibold hover:opacity-90 transition"
        >
          Open Dashboard
        </Link>
      </div>
    </main>
  );
}
