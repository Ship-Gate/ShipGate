import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">CRUD Template Examples</h1>
      <nav className="flex gap-4">
        <Link href="/posts" className="text-primary hover:underline">Posts</Link>
        <Link href="/products" className="text-primary hover:underline">Products</Link>
        <Link href="/invoices" className="text-primary hover:underline">Invoices</Link>
      </nav>
    </div>
  );
}
