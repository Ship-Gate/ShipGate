import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageSquare, Github, ExternalLink } from 'lucide-react';

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = formData.get('email') as string;
    const subject = formData.get('subject') as string;
    const message = formData.get('message') as string;
    const mailto = `mailto:team@shipgate.dev?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Email: ${email}\n\n${message}`)}`;
    window.location.href = mailto;
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <nav className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-semibold text-white">
            Shipgate
          </Link>
          <Link
            to="/"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-16">
        <header className="mb-12">
          <h1 className="text-3xl md:text-4xl font-semibold text-white mb-4">
            Contact
          </h1>
          <p className="text-zinc-400 text-lg">
            Get in touch for support, sales, or partnership inquiries.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Contact options</h2>
            <div className="space-y-4">
              <a
                href="mailto:team@shipgate.dev"
                className="flex items-center gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-emerald-400" strokeWidth={2} />
                </div>
                <div>
                  <span className="font-medium text-white">General inquiries</span>
                  <p className="text-sm text-zinc-500">team@shipgate.dev</p>
                </div>
              </a>
              <a
                href="mailto:support@shipgate.dev"
                className="flex items-center gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-emerald-400" strokeWidth={2} />
                </div>
                <div>
                  <span className="font-medium text-white">Support</span>
                  <p className="text-sm text-zinc-500">support@shipgate.dev</p>
                </div>
              </a>
              <a
                href="mailto:security@shipgate.dev"
                className="flex items-center gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-emerald-400" strokeWidth={2} />
                </div>
                <div>
                  <span className="font-medium text-white">Security</span>
                  <p className="text-sm text-zinc-500">security@shipgate.dev</p>
                </div>
              </a>
              <a
                href="https://github.com/guardiavault-oss/ISL-LANG/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Github className="w-5 h-5 text-emerald-400" strokeWidth={2} />
                </div>
                <div>
                  <span className="font-medium text-white">GitHub issues</span>
                  <p className="text-sm text-zinc-500">Bug reports and feature requests</p>
                </div>
                <ExternalLink className="w-4 h-4 text-zinc-500 ml-auto" />
              </a>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Send a message</h2>
            {submitted ? (
              <div className="p-6 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
                <p className="text-emerald-400 font-medium mb-2">Your email client should open.</p>
                <p className="text-zinc-400 text-sm">
                  If it didn&apos;t, email us directly at{' '}
                  <a href="mailto:team@shipgate.dev" className="text-emerald-400 underline">
                    team@shipgate.dev
                  </a>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="w-full px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-zinc-300 mb-2">
                    Subject
                  </label>
                  <input
                    id="subject"
                    name="subject"
                    type="text"
                    required
                    className="w-full px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                    placeholder="How can we help?"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-zinc-300 mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    className="w-full px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none"
                    placeholder="Describe your inquiry..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium hover:from-emerald-400 hover:to-teal-500 transition-all"
                >
                  Open email
                </button>
              </form>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
