/**
 * Entitlements Hooks
 * 
 * React hooks for accessing Supabase-backed entitlements in components.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  UserEntitlements,
  EntitlementCheckResult,
} from './types';
import {
  getUserEntitlements,
  checkFeatureAccess,
  recordAISessionStart,
  recordAITurn,
} from './api';

/**
 * Hook to get complete user entitlements
 * Automatically fetches on mount and provides refresh function
 */
export function useEntitlements() {
  const [entitlements, setEntitlements] = useState<UserEntitlements | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntitlements = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    const result = await getUserEntitlements();
    
    if (result.success && result.data) {
      setEntitlements(result.data);
    } else {
      setError(result.error || 'Failed to load entitlements');
    }
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchEntitlements();
  }, [fetchEntitlements]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void fetchEntitlements();
      }
    };

    const refreshOnFocus = () => {
      void fetchEntitlements();
    };

    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [fetchEntitlements]);

  const refresh = useCallback(() => {
    return fetchEntitlements();
  }, [fetchEntitlements]);

  return {
    entitlements,
    isLoading,
    error,
    refresh,
    // Convenience accessors
    subscription: entitlements?.subscription,
    aiUsage: entitlements?.aiUsage,
    features: entitlements?.features,
  };
}

/**
 * Hook to check a specific feature's access
 */
export function useFeatureAccess(
  feature: 'aiInterview' | 'pdfDownloads' | 'coupleCompare' | 'readinessCheck' | 'progressTracking'
) {
  const [access, setAccess] = useState<EntitlementCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    checkFeatureAccess(feature).then((result) => {
      if (mounted) {
        setAccess(result);
        setIsLoading(false);
      }
    });
    
    return () => { mounted = false; };
  }, [feature]);

  return { access, isLoading };
}

/**
 * Hook for AI interview session management
 * Handles session start and turn tracking with Supabase
 */
export function useAISession() {
  const { entitlements, isLoading } = useEntitlements();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive session permissions from entitlements
  const canStartSession = useMemo(() => {
    if (!entitlements) return false;
    return entitlements.aiUsage.allowed && entitlements.aiUsage.turnsRemaining > 0;
  }, [entitlements]);

  const canContinueSession = useMemo(() => {
    if (!entitlements) return false;
    return entitlements.aiUsage.allowed && entitlements.aiUsage.turnsRemaining > 0;
  }, [entitlements]);

  const usageDisplay = useMemo(() => {
    if (!entitlements) return null;
    return {
      sessionsUsed: entitlements.aiUsage.sessionsUsedToday,
      sessionsTotal: entitlements.aiUsage.maxSessionsPerDay,
      sessionsRemaining: entitlements.aiUsage.sessionsRemaining,
      turnsUsed: entitlements.aiUsage.turnsUsedToday,
      turnsTotal: entitlements.aiUsage.maxTurnsPerSession,
      turnsRemaining: entitlements.aiUsage.turnsRemaining,
    };
  }, [entitlements]);

  const startSession = useCallback(async (
    provider?: string,
    model?: string,
    topicId?: string
  ): Promise<boolean> => {
    setIsStarting(true);
    setError(null);
    
    const result = await recordAISessionStart(provider, model, topicId);
    
    if (result.success && result.sessionId) {
      setCurrentSessionId(result.sessionId);
      setIsStarting(false);
      return true;
    } else {
      setError(result.error || 'Failed to start session');
      setIsStarting(false);
      return false;
    }
  }, []);

  const recordTurn = useCallback(async (turnCount: number = 1): Promise<boolean> => {
    if (!currentSessionId) {
      setError('No active session');
      return false;
    }
    
    const result = await recordAITurn(currentSessionId, turnCount);
    
    if (!result.success) {
      setError(result.error || 'Failed to record turn');
      return false;
    }
    
    return true;
  }, [currentSessionId]);

  const endSession = useCallback(() => {
    setCurrentSessionId(null);
    setError(null);
  }, []);

  return {
    sessionId: currentSessionId,
    isStarting,
    error,
    canStartSession,
    canContinueSession,
    usageDisplay,
    isLoading,
    startSession,
    recordTurn,
    endSession,
  };
}

/**
 * Hook to get plan status for display
 */
export function usePlanStatus() {
  const { entitlements, isLoading, error, refresh } = useEntitlements();
  
  const result = useMemo(() => {
    if (!entitlements) {
      return {
        isLoading,
        error,
        refresh,
        planStatus: null as null,
        subscription: null as null,
      };
    }

    const { subscription } = entitlements;
    
    const planStatus = {
      // Plan info
      planName: getPlanDisplayName(subscription.planType),
      planType: subscription.planType,
      
      // Status
      isActive: subscription.isActive,
      isExpired: subscription.isExpired,
      daysRemaining: subscription.daysRemaining,
      
      // Trial
      isInTrial: subscription.isTrial,
      trialDaysLeft: subscription.trialDaysLeft,
      
      // Pass
      isInterviewPass: subscription.planType === 'interviewPass',
      passDaysLeft: subscription.passDaysLeft,
      
      // Lifetime
      isLifetime: subscription.isLifetime,
      
      // Actions
      canUpgrade: subscription.isActive && !subscription.isLifetime,
      canRenew: subscription.isExpired || (!subscription.isActive && !subscription.isTrial),
      
      // Access summary
      hasAccountAccess: subscription.hasAccess,
    };

    return {
      isLoading,
      error,
      refresh,
      planStatus,
      subscription,
    };
  }, [entitlements, isLoading, error, refresh]);

  return result;
}

/**
 * Hook to get AI usage display info
 */
export function useAIUsageDisplay() {
  const { entitlements, isLoading, error, refresh } = useEntitlements();
  
  if (!entitlements) {
    return {
      isLoading,
      error,
      refresh,
      usage: null,
    };
  }

  const { aiUsage, subscription } = entitlements;
  
  const usage = {
    sessionsUsed: aiUsage.sessionsUsedToday,
    sessionsTotal: aiUsage.maxSessionsPerDay,
    sessionsRemaining: aiUsage.sessionsRemaining,
    
    turnsUsed: aiUsage.turnsUsedToday,
    turnsTotal: aiUsage.maxTurnsPerSession,
    turnsRemaining: aiUsage.turnsRemaining,
    
    hasReachedLimit: !aiUsage.allowed,
    limitReason: aiUsage.reason,
    
    planType: subscription.planType,
  };

  return {
    isLoading,
    error,
    refresh,
    usage,
    aiUsage,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getPlanDisplayName(planType: string): string {
  const names: Record<string, string> = {
    trial: 'Free Account',
    monthly: 'Archived Monthly Plan',
    lifetime: 'Lifetime Access',
    interviewPass: '90-Day Interview Pass',
  };
  return names[planType] || planType;
}
