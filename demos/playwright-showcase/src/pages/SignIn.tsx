import { SignIn as ClerkSignIn } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import '../components/ContentCard.css';

export default function SignIn() {
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
          <p className="text-white/90 mb-4">Sign-in is not configured.</p>
          <p className="text-white/70 text-sm mb-6">Set VITE_CLERK_PUBLISHABLE_KEY in .env to enable authentication.</p>
          <Link to="/dashboard" className="text-cyan-400 hover:underline">Continue to Dashboard</Link>
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
        <ClerkSignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          afterSignInUrl="/dashboard"
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
