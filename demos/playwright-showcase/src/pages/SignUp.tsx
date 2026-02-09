import { SignUp as ClerkSignUp } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import '../components/ContentCard.css';

export default function SignUp() {
  const clerkKey = typeof import.meta.env.VITE_CLERK_PUBLISHABLE_KEY === 'string'
    ? import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
    : '';
  if (!clerkKey) {
    return (
      <div className="min-h-screen pt-24 pb-20 flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="soft-card p-8 max-w-md text-center"
        >
          <p className="text-white/90 mb-4">Sign-up is not configured.</p>
          <p className="text-white/70 text-sm mb-6">Set VITE_CLERK_PUBLISHABLE_KEY in .env to enable authentication.</p>
          <Link to="/sign-in" className="text-cyan-400 hover:underline">Sign in</Link>
          <span className="text-white/50 mx-2">·</span>
          <Link to="/dashboard" className="text-cyan-400 hover:underline">Dashboard</Link>
        </motion.div>
      </div>
    );
  }
  return (
    <div className="min-h-screen pt-24 pb-20 flex flex-col items-center justify-start">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex justify-center [&_.clerk-modal]:!bg-white/10 [&_.clerk-modal]:!backdrop-blur-md [&_.clerk-modal]:!border-white/20"
      >
        <ClerkSignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          afterSignUpUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'bg-white/10 backdrop-blur-md border border-white/20 shadow-xl',
            },
            variables: {
              colorPrimary: '#06b6d4',
              colorBackground: 'rgba(255,255,255,0.08)',
              borderRadius: '1rem',
            },
          }}
        />
      </motion.div>
    </div>
  );
}
