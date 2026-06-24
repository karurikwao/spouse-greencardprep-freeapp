/**
 * Practice Context
 * Provides practice state throughout the component tree
 */

import { createContext, useContext, type ReactNode } from 'react';
import { usePracticeState, type PracticeStateReturn } from '@/hooks/usePracticeState';

const PracticeContext = createContext<PracticeStateReturn | null>(null);

export function PracticeProvider({ children }: { children: ReactNode }) {
  const practiceState = usePracticeState();
  
  return (
    <PracticeContext.Provider value={practiceState}>
      {children}
    </PracticeContext.Provider>
  );
}

export function usePractice() {
  const context = useContext(PracticeContext);
  if (!context) {
    throw new Error('usePractice must be used within a PracticeProvider');
  }
  return context;
}

export { PracticeContext };
