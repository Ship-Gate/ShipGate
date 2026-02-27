import { Chrome, Github } from 'lucide-react';

interface OAuthButtonsProps {
  onOAuthStart?: () => void;
}

export default function OAuthButtons({ onOAuthStart }: OAuthButtonsProps) {
  const handleGoogleAuth = () => {
    onOAuthStart?.();
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://shipgate-backend.vercel.app';
    const redirectUrl = encodeURIComponent(window.location.origin);
    window.location.href = `${backendUrl}/api/auth/google?redirect=${redirectUrl}`;
  };

  const handleGitHubAuth = () => {
    onOAuthStart?.();
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://shipgate-backend.vercel.app';
    const redirectUrl = encodeURIComponent(window.location.origin);
    window.location.href = `${backendUrl}/api/auth/github?redirect=${redirectUrl}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <button
        onClick={handleGoogleAuth}
        style={{
          width: '100%',
          padding: '12px 16px',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        }}
      >
        <Chrome size={18} />
        Continue with Google
      </button>

      <button
        onClick={handleGitHubAuth}
        style={{
          width: '100%',
          padding: '12px 16px',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        }}
      >
        <Github size={18} />
        Continue with GitHub
      </button>
    </div>
  );
}
