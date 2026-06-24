/**
 * useReferralTracking Hook
 * 
 * React hook for managing referral code tracking.
 * Captures referral codes from URL, stores them in localStorage,
 * and provides utilities for working with promo codes.
 * 
 * Usage:
 * ```tsx
 * function App() {
 *   useReferralTracking(); // Captures ref codes on mount
 *   return <div>...</div>;
 * }
 * ```
 */

import { useEffect, useCallback, useState } from 'react';
import {
  captureReferralFromUrl,
  getStoredReferralCode,
  getReferralContext,
  storeReferralCode,
  clearStoredReferralCode,
  validatePromoCode,
  recordSignupEvent,
  recordPurchaseEvent,
  calculateDiscountedPrice,
  formatPrice,
} from '@/lib/promo';
import type { 
  PromoCodeValidationResult, 
  DiscountCalculation,
} from '@/lib/promo';
import type { PlanType } from '@/lib/plans';

interface UseReferralTrackingReturn {
  // State
  referralCode: string | null;
  referrer: string | null;
  landingPage: string | null;
  isValidating: boolean;
  validationResult: PromoCodeValidationResult | null;
  
  // Actions
  validateCode: (code: string) => Promise<PromoCodeValidationResult>;
  storeCode: (code: string) => void;
  clearCode: () => void;
  recordSignup: (userId: string) => Promise<{ success: boolean; error?: string }>;
  recordPurchase: (userId: string, planType: PlanType) => Promise<{ success: boolean; error?: string }>;
  calculateDiscount: (planType: PlanType, code?: string) => Promise<DiscountCalculation>;
  
  // Utilities
  formatPrice: (price: number) => string;
}

/**
 * Hook for managing referral tracking
 */
export function useReferralTracking(): UseReferralTrackingReturn {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrer, setReferrer] = useState<string | null>(null);
  const [landingPage, setLandingPage] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<PromoCodeValidationResult | null>(null);

  // Load stored referral code on mount
  useEffect(() => {
    const context = getReferralContext();
    setReferralCode(context.code);
    setReferrer(context.source);
    setLandingPage(context.landingPage);
  }, []);

  /**
   * Validate a promo code
   */
  const validateCode = useCallback(async (code: string): Promise<PromoCodeValidationResult> => {
    setIsValidating(true);
    try {
      const result = await validatePromoCode(code);
      setValidationResult(result);
      return result;
    } finally {
      setIsValidating(false);
    }
  }, []);

  /**
   * Store a referral code
   */
  const storeCode = useCallback((code: string) => {
    storeReferralCode(code);
    setReferralCode(code.toUpperCase().trim());
  }, []);

  /**
   * Clear the stored referral code
   */
  const clearCode = useCallback(() => {
    clearStoredReferralCode();
    setReferralCode(null);
    setReferrer(null);
    setLandingPage(null);
    setValidationResult(null);
  }, []);

  /**
   * Record a signup event
   */
  const recordSignup = useCallback(async (userId: string) => {
    return recordSignupEvent(userId);
  }, []);

  /**
   * Record a purchase event
   */
  const recordPurchase = useCallback(async (userId: string, planType: PlanType) => {
    return recordPurchaseEvent(userId, planType);
  }, []);

  /**
   * Calculate discounted price
   */
  const calculateDiscount = useCallback(async (planType: PlanType, code?: string) => {
    const promoCode = code || referralCode || undefined;
    return calculateDiscountedPrice(planType, promoCode);
  }, [referralCode]);

  return {
    // State
    referralCode,
    referrer,
    landingPage,
    isValidating,
    validationResult,
    
    // Actions
    validateCode,
    storeCode,
    clearCode,
    recordSignup,
    recordPurchase,
    calculateDiscount,
    
    // Utilities
    formatPrice,
  };
}

/**
 * Hook that automatically captures referral code from URL on mount
 * Use this in your root App component or layout
 */
export function useCaptureReferralOnMount(): void {
  useEffect(() => {
    captureReferralFromUrl();
  }, []);
}

/**
 * Hook for working with promo code input
 */
export function usePromoCodeInput(initialCode: string = '') {
  const [code, setCode] = useState(initialCode);
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<PromoCodeValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(async () => {
    if (!code.trim()) {
      setError('Please enter a promo code');
      return null;
    }

    setIsValidating(true);
    setError(null);

    try {
      const validationResult = await validatePromoCode(code);
      setResult(validationResult);
      
      if (!validationResult.valid) {
        setError('Invalid promo code');
      }
      
      return validationResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation failed';
      setError(message);
      return null;
    } finally {
      setIsValidating(false);
    }
  }, [code]);

  const clear = useCallback(() => {
    setCode('');
    setResult(null);
    setError(null);
  }, []);

  return {
    code,
    setCode,
    isValidating,
    result,
    error,
    validate,
    clear,
    isValid: result?.valid || false,
  };
}

// Re-export utility functions for convenience
export {
  getStoredReferralCode,
  storeReferralCode,
  clearStoredReferralCode,
  formatPrice,
};
