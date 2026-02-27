'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, ArrowLeft } from 'lucide-react';
import OAuthButtons from '../components/OAuthButtons';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Simulate authentication - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For demo purposes, accept any email/password
      if (email && password) {
        // Redirect to dashboard or home page
        window.location.href = '/';
      } else {
        setError('Please enter email and password');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
      padding: '20px',
      fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'rgba(6, 6, 10, 0.95)',
          backdropFilter: 'blur(16px) saturate(140%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.8)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: 60,
            height: 60,
            margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: 'bold',
            color: 'white',
          }}>
            SG
          </div>
          <h1 style={{ 
            fontSize: '24px', 
            fontWeight: '700', 
            color: '#ffffff', 
            margin: '0 0 8px 0',
            letterSpacing: '-0.02em',
          }}>
            Sign in to ShipGate
          </h1>
          <p style={{ 
            fontSize: '14px', 
            color: 'rgba(255, 255, 255, 0.6)', 
            margin: 0,
            lineHeight: 1.5,
          }}>
            Enter your credentials to access your account
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <p style={{ 
              fontSize: '14px', 
              color: 'rgba(255, 255, 255, 0.6)', 
              margin: 0,
            }}>
              Choose your preferred sign in method
            </p>
          </div>

          {/* OAuth Buttons */}
          <OAuthButtons onOAuthStart={() => setLoading(true)} />

          {/* Divider */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            margin: '8px 0',
          }}>
            <div style={{ 
              flex: 1, 
              height: '1px', 
              background: 'rgba(255, 255, 255, 0.1)' 
            }} />
            <span style={{ 
              fontSize: '12px', 
              color: 'rgba(255, 255, 255, 0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              OR
            </span>
            <div style={{ 
              flex: 1, 
              height: '1px', 
              background: 'rgba(255, 255, 255, 0.1)' 
            }} />
          </div>

          {/* Error message */}
          {error && (
            <p style={{ 
              fontSize: '14px', 
              color: '#ef4444',
              textAlign: 'center',
              margin: '0',
            }}>
              {error}
            </p>
          )}
        </div>

        {/* Back to home link */}
        <p style={{ 
          textAlign: 'center', 
          marginTop: '24px',
          fontSize: '14px',
          color: 'rgba(255, 255, 255, 0.6)',
        }}>
          <a 
            href="/" 
            style={{ 
              color: '#0ea5e9', 
              textDecoration: 'none',
              fontWeight: '500',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowLeft size={16} />
            Back to home
          </a>
        </p>
      </motion.div>
    </div>
  );
}
