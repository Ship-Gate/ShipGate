import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || 'https://app.shipgate.dev';

interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  provider: string;
  isPro?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch(`${DASHBOARD_URL}/api/v1/me`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setUser(json.data);
      }
    } catch {
      // Not authenticated — that's fine for a landing page
    } finally {
      setIsLoading(false);
    }
  };

  const login = () => {
    window.location.href = `${DASHBOARD_URL}/api/auth/google`;
  };

  const logout = () => {
    setUser(null);
    window.location.href = `${DASHBOARD_URL}/api/auth/logout`;
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
