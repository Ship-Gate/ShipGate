'use client';

import { useState, useEffect } from 'react';

interface Service {
  id: string;
  name: string;
  description: string;
}

export default function HomePage() {
  const [services, setServices] = useState<Service[]>([]);
  const [formState, setFormState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    fetch('/api/services')
      .then((res) => res.json())
      .then(setServices)
      .catch(() => setServices([]));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: (formData.get('phone') as string) || undefined,
      message: formData.get('message') as string,
      serviceInterest: (formData.get('serviceInterest') as string) || undefined,
    };

    setFormState('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { success: boolean; message: string };

      if (!res.ok) {
        setFormState('error');
        setErrorMessage(data.message ?? 'Something went wrong.');
        return;
      }

      setFormState('success');
      form.reset();
    } catch {
      setFormState('error');
      setErrorMessage('Network error. Please try again.');
    }
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <header className="bg-gradient-to-b from-stone-800 to-stone-900 text-white">
        <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
          <span className="text-xl font-bold tracking-tight">5280 Remodeling</span>
          <a href="#contact" className="text-sm font-medium text-amber-400 hover:text-amber-300">
            Get a Quote
          </a>
        </nav>
        <div className="container mx-auto px-4 py-20 md:py-28 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            Denver&apos;s Trusted Handyman
          </h1>
          <p className="text-xl text-stone-300 max-w-2xl mx-auto mb-8">
            Kitchen remodels, bathroom updates, decks, flooring, and general repairs. Licensed, insured, and ready to bring your vision to life.
          </p>
          <a
            href="#contact"
            className="inline-block px-8 py-4 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg transition-colors"
          >
            Request a Free Quote
          </a>
        </div>
      </header>

      {/* Services */}
      <section id="services" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-stone-900">
            Our Services
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((s) => (
              <div
                key={s.id}
                className="p-6 rounded-xl border border-stone-200 bg-stone-50 hover:border-primary-200 hover:shadow-md transition-all"
              >
                <h3 className="text-lg font-semibold text-stone-900 mb-2">{s.name}</h3>
                <p className="text-stone-600 text-sm">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 bg-stone-100">
        <div className="container mx-auto px-4 max-w-xl">
          <h2 className="text-3xl font-bold text-center mb-8 text-stone-900">
            Get a Free Quote
          </h2>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-stone-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                maxLength={255}
                className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Your name"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-stone-700 mb-1">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                maxLength={20}
                className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="(303) 555-0123"
              />
            </div>
            <div>
              <label htmlFor="serviceInterest" className="block text-sm font-medium text-stone-700 mb-1">
                Service of interest
              </label>
              <select
                id="serviceInterest"
                name="serviceInterest"
                className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select a service</option>
                {services.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-stone-700 mb-1">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={4}
                maxLength={2000}
                className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Describe your project..."
              />
            </div>
            {formState === 'success' && (
              <p className="text-green-600 font-medium">Thank you! We will get back to you soon.</p>
            )}
            {formState === 'error' && (
              <p className="text-red-600 font-medium">{errorMessage}</p>
            )}
            <button
              type="submit"
              disabled={formState === 'loading'}
              className="w-full py-3 bg-primary hover:bg-primary-600 disabled:bg-stone-400 text-white font-semibold rounded-lg transition-colors"
            >
              {formState === 'loading' ? 'Sending...' : 'Submit'}
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-stone-800 text-stone-400 text-center text-sm">
        <p>© {new Date().getFullYear()} 5280 Remodeling. Denver, CO.</p>
      </footer>
    </div>
  );
}
