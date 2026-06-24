/**
* Promo Code Service
*
* Client-side utilities for managing promo codes and referral tracking.
* This module provides functions for:
* - Validating promo codes
* - Managing referral codes in localStorage
* - Recording referral events
* - Calculating discounted prices
*/

import { apiClient } from '@/lib/apiClient';
import type { PlanType } from '@/lib/plans';
import { PLAN_CONFIG } from '@/lib/plans';
import type {
PromoCodeValidationResult,
DiscountCalculation,
CreateReferralEventParams,
} from './types';
import {
REFERRAL_STORAGE_KEY,
REFERRAL_SOURCE_KEY,
REFERRAL_LANDING_KEY,
} from './types';

// Re-export types
export * from './types';

// ============================================================================
// Local Storage Management
// ============================================================================

/**
* Get the stored referral code from localStorage
*/
export function getStoredReferralCode(): string | null {
if (typeof window === 'undefined') return null;
return localStorage.getItem(REFERRAL_STORAGE_KEY);
}

/**
* Store a referral code in localStorage
*/
export function storeReferralCode(code: string): void {
if (typeof window === 'undefined') return;
localStorage.setItem(REFERRAL_STORAGE_KEY, code.toUpperCase().trim());
}

/**
* Clear the stored referral code
*/
export function clearStoredReferralCode(): void {
if (typeof window === 'undefined') return;
localStorage.removeItem(REFERRAL_STORAGE_KEY);
localStorage.removeItem(REFERRAL_SOURCE_KEY);
localStorage.removeItem(REFERRAL_LANDING_KEY);
}

/**
* Get full referral context from localStorage
*/
export function getReferralContext(): {
code: string | null;
source: string | null;
landingPage: string | null;
} {
if (typeof window === 'undefined') {
return { code: null, source: null, landingPage: null };
}
return {
code: localStorage.getItem(REFERRAL_STORAGE_KEY),
source: localStorage.getItem(REFERRAL_SOURCE_KEY),
landingPage: localStorage.getItem(REFERRAL_LANDING_KEY),
};
}

/**
* Store full referral context
*/
export function storeReferralContext(
code: string,
source?: string,
landingPage?: string
): void {
if (typeof window === 'undefined') return;
localStorage.setItem(REFERRAL_STORAGE_KEY, code.toUpperCase().trim());
if (source) {
localStorage.setItem(REFERRAL_SOURCE_KEY, source);
}
if (landingPage) {
localStorage.setItem(REFERRAL_LANDING_KEY, landingPage);
}
}

// ============================================================================
// URL Parsing
// ============================================================================

/**
* Parse referral code from URL query parameters
* Supports formats: ?ref=CODE, ?promo=CODE, ?code=CODE
*/
export function parseReferralFromUrl(url?: string): string | null {
if (typeof window === 'undefined') return null;

const searchParams = new URLSearchParams(url || window.location.search);
const code = searchParams.get('ref') ||
searchParams.get('promo') ||
searchParams.get('code');

return code ? code.toUpperCase().trim() : null;
}

/**
* Parse referral code from URL path
* Supports format: /ref/CODE
*/
export function parseReferralFromPath(path?: string): string | null {
if (typeof window === 'undefined') return null;

const currentPath = path || window.location.pathname;
const match = currentPath.match(/^\/ref\/([^/]+)$/);

return match ? match[1].toUpperCase().trim() : null;
}

/**
* Check if current URL contains a referral code and store it
*/
export function captureReferralFromUrl(): string | null {
const code = parseReferralFromUrl();
if (code) {
const source = new URLSearchParams(window.location.search).get('utm_source') || 'direct';
storeReferralContext(code, source, window.location.href);

// Record visit event
recordReferralEvent({
promoCode: code,
referrer: source,
landingPage: window.location.href,
eventType: 'visit',
}).catch(console.error);
}
return code;
}

// ============================================================================
// Promo Code Validation
// ============================================================================

/**
* Validate a promo code with the database
*/
export async function validatePromoCode(
code: string
): Promise<PromoCodeValidationResult> {
try {
const { data, error } = await apiClient.rpc('validate_promo_code', {
code,
});

if (error) {
console.error('Error validating promo code:', error);
return {
valid: false,
code: null,
discount_percent: null,
influencer_name: null,
};
}

// Handle both array and single object responses
const result = Array.isArray(data) ? data[0] : data;

return {
valid: result?.valid || false,
code: result?.code || null,
discount_percent: result?.discount_percent || null,
influencer_name: result?.influencer_name || null,
};
} catch (err) {
console.error('Unexpected error validating promo code:', err);
return {
valid: false,
code: null,
discount_percent: null,
influencer_name: null,
};
}
}

/**
* Check if a promo code is valid (local check only, no API call)
*/
export function isValidPromoCodeFormat(code: string): boolean {
if (!code || typeof code !== 'string') return false;
const trimmed = code.trim();
return trimmed.length >= 3 && trimmed.length <= 20 && /^[A-Z0-9_-]+$/i.test(trimmed);
}

// ============================================================================
// Referral Event Recording
// ============================================================================

/**
* Record a referral event in the database
*/
export async function recordReferralEvent(
params: CreateReferralEventParams
): Promise<{ success: boolean; error?: string }> {
try {
const { error } = await apiClient.rpc('record_referral_event', {
userId: params.userId || null,
promoCode: params.promoCode || null,
referrer: params.referrer || null,
landingPage: params.landingPage || null,
eventType: params.eventType || 'visit',
metadata: params.metadata || {},
});

if (error) {
console.error('Error recording referral event:', error);
return { success: false, error: error.message };
}

return { success: true };
} catch (err) {
console.error('Unexpected error recording referral event:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error'
};
}
}

/**
* Record a signup event with the stored referral code
*/
export async function recordSignupEvent(
userId: string,
additionalMetadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
const { code, source, landingPage } = getReferralContext();

if (!code) {
return { success: true }; // No referral code, nothing to record
}

const result = await recordReferralEvent({
userId,
promoCode: code,
referrer: source || undefined,
landingPage: landingPage || undefined,
eventType: 'signup',
metadata: additionalMetadata,
});

return result;
}

/**
* Record a checkout/purchase event
*/
export async function recordPurchaseEvent(
userId: string,
planType: PlanType,
promoCode?: string,
additionalMetadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
const storedCode = getStoredReferralCode();
const code = promoCode || storedCode;

if (!code) {
return { success: true }; // No referral code, nothing to record
}

const result = await recordReferralEvent({
userId,
promoCode: code,
eventType: 'purchase',
metadata: {
plan_type: planType,
...additionalMetadata,
},
});

// Clear the referral code after successful purchase
if (result.success) {
clearStoredReferralCode();
}

return result;
}

// ============================================================================
// Price Calculation
// ============================================================================

/**
* Calculate discounted price for a plan
* This is done client-side for display purposes; actual pricing is handled server-side
*/
export async function calculateDiscountedPrice(
planType: PlanType,
promoCode?: string
): Promise<DiscountCalculation> {
const plan = PLAN_CONFIG[planType];
const originalPrice = plan.price;

// If no promo code or trial plan, return original price
if (!promoCode || planType === 'trial') {
return {
valid: false,
original_price: originalPrice,
discount_percent: 0,
discount_amount: 0,
final_price: originalPrice,
};
}

// Validate promo code
const validation = await validatePromoCode(promoCode);

if (!validation.valid || !validation.discount_percent) {
return {
valid: false,
original_price: originalPrice,
discount_percent: 0,
discount_amount: 0,
final_price: originalPrice,
};
}

const discountPercent = validation.discount_percent;
const discountAmount = Math.round(originalPrice * discountPercent) / 100;
const finalPrice = Math.round((originalPrice - discountAmount) * 100) / 100;

return {
valid: true,
original_price: originalPrice,
discount_percent: discountPercent,
discount_amount: discountAmount,
final_price: finalPrice,
};
}

/**
* Format price for display
*/
export function formatPrice(price: number): string {
return new Intl.NumberFormat('en-US', {
style: 'currency',
currency: 'USD',
minimumFractionDigits: 2,
}).format(price);
}

// ============================================================================
// Checkout Integration
// ============================================================================

/**
* Get checkout parameters including promo code
* Use this when creating a checkout session
*/
export function getCheckoutParams(): {
promoCode: string | null;
referrer: string | null;
} {
const { code, source } = getReferralContext();
return {
promoCode: code,
referrer: source,
};
}

/**
* Clear all referral data after checkout completion
*/
export function clearReferralData(): void {
clearStoredReferralCode();
}
