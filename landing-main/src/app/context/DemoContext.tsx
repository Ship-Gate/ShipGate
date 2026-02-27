import { createContext, useContext, useState, ReactNode } from 'react';

interface DemoContextType {
  isDemoPlaying: boolean;
  setIsDemoPlaying: (playing: boolean) => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);

  return (
    <DemoContext.Provider value={{ isDemoPlaying, setIsDemoPlaying }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoContext() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error('useDemoContext must be used within a DemoProvider');
  }
  return context;
}
