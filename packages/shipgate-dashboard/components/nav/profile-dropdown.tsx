'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

type SessionUser = { id: string; email: string; name: string; avatar?: string; provider: string };

export function ProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsOpen(false);
    router.push('/');
  }

  const initial = user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-sg-bg2/50 transition-colors"
      >
        {/* PRO Badge */}
        <div
          className="px-2 py-0.5 rounded-full border text-[10px] font-semibold"
          style={{
            backgroundColor: 'rgba(0,230,138,0.08)',
            borderColor: 'rgba(0,230,138,0.2)',
            color: '#00e68a',
          }}
        >
          PRO
        </div>

        {/* Avatar */}
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt=""
            className="w-7 h-7 rounded-full object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-sg-bg3 flex items-center justify-center text-[11px] font-semibold text-sg-text1">
            {initial}
          </div>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-48 bg-sg-bg1 border border-sg-border rounded-lg shadow-lg overflow-hidden z-50"
          >
            <div className="p-3 border-b border-sg-border">
              <div className="text-sm font-semibold text-sg-text0">
                {user?.name ?? 'User'}
              </div>
              <div className="text-xs text-sg-text3 truncate">
                {user?.email ?? ''}
              </div>
            </div>

            <div className="py-1">
              <button
                onClick={() => { setIsOpen(false); router.push('/dashboard/settings'); }}
                className="w-full px-3 py-2 text-left text-xs text-sg-text1 hover:bg-sg-bg2/50 transition-colors"
              >
                Profile Settings
              </button>
              <button
                onClick={() => { setIsOpen(false); router.push('/dashboard/api-keys'); }}
                className="w-full px-3 py-2 text-left text-xs text-sg-text1 hover:bg-sg-bg2/50 transition-colors"
              >
                API Keys
              </button>
              <button
                onClick={() => { setIsOpen(false); router.push('/dashboard/billing'); }}
                className="w-full px-3 py-2 text-left text-xs text-sg-text1 hover:bg-sg-bg2/50 transition-colors"
              >
                Billing
              </button>
              <div className="border-t border-sg-border my-1"></div>
              <button
                onClick={handleSignOut}
                className="w-full px-3 py-2 text-left text-xs text-sg-noship hover:bg-sg-noship/10 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click outside to close */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
