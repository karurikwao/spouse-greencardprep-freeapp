/**
* Promo Code Admin Functions
*
* Server-side functions for admin reporting and management.
* These require service role access and are intended for use in:
* - Edge functions
* - Admin dashboards
* - Server-side operations
*/

import { apiClient } from '@/lib/apiClient';
import type { PromoCode, PromoCodeStats, PromoCodeDetailedStats } from './types';

// ============================================================================
// Admin Reporting Functions
// ============================================================================

/**
* Get statistics for a specific promo code
* Requires service role or admin access
*/
export async function getPromoCodeStats(
code: string
): Promise<PromoCodeStats | null> {
try {
const { data, error } = await apiClient.rpc('get_promo_code_stats', {
code,
});

if (error) {
console.error('Error fetching promo code stats:', error);
return null;
}

const result = Array.isArray(data) ? data[0] : data;
if (!result) return null;

return {
promo_code: result.promo_code,
total_referrals: Number(result.total_referrals) || 0,
total_signups: Number(result.total_signups) || 0,
total_checkouts: Number(result.total_checkouts) || 0,
total_purchases: Number(result.total_purchases) || 0,
total_paid_users: Number(result.total_paid_users) || 0,
};
} catch (err) {
console.error('Unexpected error fetching promo code stats:', err);
return null;
}
}

/**
* Get statistics for all promo codes
* Requires service role or admin access
*/
export async function getAllPromoCodeStats(): Promise<PromoCodeDetailedStats[]> {
try {
const { data, error } = await apiClient.rpc('get_all_promo_code_stats', {});

if (error) {
console.error('Error fetching all promo code stats:', error);
return [];
}

if (!data) return [];

const results = Array.isArray(data) ? data : [data];

return results.map((item) => ({
promo_code: item.promo_code,
influencer_name: item.influencer_name,
discount_percent: item.discount_percent,
is_active: item.is_active,
total_referrals: Number(item.total_referrals) || 0,
total_signups: Number(item.total_signups) || 0,
total_checkouts: 0, // Not tracked in this view
total_purchases: Number(item.total_purchases) || 0,
total_paid_users: Number(item.total_paid_users) || 0,
}));
} catch (err) {
console.error('Unexpected error fetching all promo code stats:', err);
return [];
}
}

// ============================================================================
// Promo Code Management
// ============================================================================

export interface CreatePromoCodeParams {
code: string;
description?: string;
discountPercent: number;
influencerName: string;
isActive?: boolean;
}

export interface UpdatePromoCodeParams {
description?: string;
discountPercent?: number;
influencerName?: string;
isActive?: boolean;
}

/**
* Create a new promo code
* Requires service role or admin access
*/
export async function createPromoCode(
params: CreatePromoCodeParams
): Promise<{ success: boolean; promoCode?: PromoCode; error?: string }> {
try {
const { data, error } = await apiClient
.from('promo_codes')
.insert({
code: params.code.toUpperCase().trim(),
description: params.description || null,
discount_percent: params.discountPercent,
influencer_name: params.influencerName,
is_active: params.isActive ?? true,
})
.single();

if (error) {
console.error('Error creating promo code:', error);
return { success: false, error: error.message };
}

return { success: true, promoCode: data as PromoCode };
} catch (err) {
console.error('Unexpected error creating promo code:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error'
};
}
}

/**
* Update an existing promo code
* Requires service role or admin access
*/
export async function updatePromoCode(
code: string,
params: UpdatePromoCodeParams
): Promise<{ success: boolean; promoCode?: PromoCode; error?: string }> {
try {
const updateData: Record<string, unknown> = {
updated_at: new Date().toISOString(),
};

if (params.description !== undefined) {
updateData.description = params.description;
}
if (params.discountPercent !== undefined) {
updateData.discount_percent = params.discountPercent;
}
if (params.influencerName !== undefined) {
updateData.influencer_name = params.influencerName;
}
if (params.isActive !== undefined) {
updateData.is_active = params.isActive;
}

const { data, error } = await apiClient
.from('promo_codes')
.update(updateData)
.eq('code', code.toUpperCase().trim())
.single();

if (error) {
console.error('Error updating promo code:', error);
return { success: false, error: error.message };
}

return { success: true, promoCode: data as PromoCode };
} catch (err) {
console.error('Unexpected error updating promo code:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error'
};
}
}

/**
* Delete a promo code
* Requires service role or admin access
*/
export async function deletePromoCode(
code: string
): Promise<{ success: boolean; error?: string }> {
try {
const { error } = await apiClient
.from('promo_codes')
.delete()
.eq('code', code.toUpperCase().trim());

if (error) {
console.error('Error deleting promo code:', error);
return { success: false, error: error.message };
}

return { success: true };
} catch (err) {
console.error('Unexpected error deleting promo code:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error'
};
}
}

/**
* Get all promo codes
* Requires service role or admin access
*/
export async function getAllPromoCodes(): Promise<PromoCode[]> {
try {
const { data, error } = await apiClient
.from('promo_codes')
.select('*')
.order('created_at', { ascending: false });

if (error) {
console.error('Error fetching promo codes:', error);
return [];
}

return (data as PromoCode[]) || [];
} catch (err) {
console.error('Unexpected error fetching promo codes:', err);
return [];
}
}

/**
* Toggle promo code active status
* Requires service role or admin access
*/
export async function togglePromoCodeStatus(
code: string,
isActive: boolean
): Promise<{ success: boolean; error?: string }> {
return updatePromoCode(code, { isActive });
}

// ============================================================================
// Referral Event Queries
// ============================================================================

export interface ReferralEventFilter {
promoCode?: string;
eventType?: string;
startDate?: string;
endDate?: string;
limit?: number;
}

/**
* Query referral events with filters
* Requires service role or admin access
*/
export async function queryReferralEvents(
filters: ReferralEventFilter = {}
): Promise<{ success: boolean; events?: unknown[]; error?: string }> {
try {
const { data, error } = await apiClient
.from('referral_events')
.select('*')
.order('created_at', { ascending: false });

if (error) {
console.error('Error querying referral events:', error);
return { success: false, error: error.message };
}

let events = (data as unknown[]) || [];

if (filters.promoCode) {
events = events.filter((e: any) =>
e.promo_code?.toUpperCase() === filters.promoCode!.toUpperCase().trim()
);
}

if (filters.eventType) {
events = events.filter((e: any) => e.event_type === filters.eventType);
}

if (filters.startDate) {
events = events.filter((e: any) => e.created_at >= filters.startDate!);
}

if (filters.endDate) {
events = events.filter((e: any) => e.created_at <= filters.endDate!);
}

if (filters.limit) {
events = events.slice(0, filters.limit);
}

return { success: true, events };
} catch (err) {
console.error('Unexpected error querying referral events:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error'
};
}
}

// ============================================================================
// Summary Dashboard Data
// ============================================================================

export interface DashboardSummary {
totalCodes: number;
activeCodes: number;
totalReferrals: number;
totalSignups: number;
totalPurchases: number;
totalPaidUsers: number;
topPerformingCodes: PromoCodeDetailedStats[];
}

/**
* Get summary data for the admin dashboard
*/
export async function getDashboardSummary(): Promise<DashboardSummary> {
const allStats = await getAllPromoCodeStats();

const activeCodes = allStats.filter((s) => s.is_active);

return {
totalCodes: allStats.length,
activeCodes: activeCodes.length,
totalReferrals: allStats.reduce((sum, s) => sum + s.total_referrals, 0),
totalSignups: allStats.reduce((sum, s) => sum + s.total_signups, 0),
totalPurchases: allStats.reduce((sum, s) => sum + s.total_purchases, 0),
totalPaidUsers: allStats.reduce((sum, s) => sum + s.total_paid_users, 0),
topPerformingCodes: allStats
.sort((a, b) => b.total_purchases - a.total_purchases)
.slice(0, 5),
};
}
