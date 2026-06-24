/**
 * Promo Code and Referral Types
 * 
 * Type definitions for the influencer promo code and referral tracking system.
 */

// ============================================================================
// Promo Code Types
// ============================================================================

export interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discount_percent: number;
  influencer_name: string;
  is_active: boolean;
  created_at: string;
}

export interface PromoCodeValidationResult {
  valid: boolean;
  code: string | null;
  discount_percent: number | null;
  influencer_name: string | null;
}

export interface DiscountCalculation {
  valid: boolean;
  original_price: number;
  discount_percent: number;
  discount_amount: number;
  final_price: number;
}

// ============================================================================
// Referral Event Types
// ============================================================================

export type ReferralEventType = 'visit' | 'signup' | 'checkout' | 'purchase';

export interface ReferralEvent {
  id: string;
  user_id: string | null;
  promo_code: string | null;
  referrer: string | null;
  landing_page: string | null;
  event_type: ReferralEventType;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateReferralEventParams {
  userId?: string;
  promoCode?: string;
  referrer?: string;
  landingPage?: string;
  eventType?: ReferralEventType;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Referral Stats Types
// ============================================================================

export interface PromoCodeStats {
  promo_code: string;
  total_referrals: number;
  total_signups: number;
  total_checkouts: number;
  total_purchases: number;
  total_paid_users: number;
}

export interface PromoCodeDetailedStats extends PromoCodeStats {
  influencer_name: string;
  discount_percent: number;
  is_active: boolean;
}

// ============================================================================
// Storage Keys
// ============================================================================

export const REFERRAL_STORAGE_KEY = 'interview-ready-referral-code';
export const REFERRAL_SOURCE_KEY = 'interview-ready-referral-source';
export const REFERRAL_LANDING_KEY = 'interview-ready-referral-landing';
