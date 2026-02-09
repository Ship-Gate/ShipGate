import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const clerkPublishableKey = typeof import.meta.env.VITE_CLERK_PUBLISHABLE_KEY === 'string'
  ? import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  : '';

function Root() {
  const [ClerkProvider, setClerkProvider] = React.useState<React.ComponentType<{ publishableKey: string; children: React.ReactNode }> | null>(null);

  React.useEffect(() => {
    if (!clerkPublishableKey) {
      setClerkProvider(null);
      return;
    }
    import('@clerk/clerk-react')
      .then((mod) => setClerkProvider(() => mod.ClerkProvider))
      .catch(() => setClerkProvider(null));
  }, []);

  if (ClerkProvider && clerkPublishableKey) {
    return (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <App />
      </ClerkProvider>
    );
  }
  return <App />;
}

const root = (
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>
);

ReactDOM.createRoot(document.getElementById('root')!).render(root);
