/**
* Refund System API
* Functions for managing refund requests
*/

import { apiClient } from '@/lib/apiClient';
import type {
RefundRequest,
RefundRequestInput,
RefundEligibility,
AdminRefundRequest,
RefundReason
} from './types';

export interface BillingRefundRequestResult {
success: boolean;
refundRequestId?: string;
eligibilityStatus?: RefundRequest['eligibilityStatus'];
amount?: number;
daysSincePurchase?: number;
message?: string;
error?: string;
}

/**
* Create a new refund request
*/
export async function createRefundRequest(
input: RefundRequestInput
): Promise<{ success: boolean; data?: RefundRequest; error?: string }> {
try {
const { data: user } = await apiClient.auth.getUser();
if (!user) {
return { success: false, error: 'User not authenticated' };
}

const { data, error } = await apiClient
.rpc('create_refund_request', {
userId: user.id,
subscriptionId: input.subscriptionId || null,
stripePaymentIntentId: input.stripePaymentIntentId || null,
planType: input.planType,
amount: input.amount,
reason: input.reason,
additionalComments: input.additionalComments || null,
});

if (error) {
console.error('Error creating refund request:', error);
return { success: false, error: error.message };
}

// Fetch the created refund request
const { data: refundData, error: fetchError } = await apiClient
.from('refund_requests')
.select('*')
.eq('id', data)
.single();

if (fetchError) {
return { success: false, error: fetchError.message };
}

return { success: true, data: refundData as RefundRequest };
} catch (err) {
console.error('Error creating refund request:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error'
};
}
}

/**
* Create a refund request from the active Stripe billing record.
*/
export async function createBillingRefundRequest(input: {
reason: RefundReason | string;
additionalComments?: string;
}): Promise<BillingRefundRequestResult> {
try {
const { data, error } = await apiClient.invokeFunction<BillingRefundRequestResult>('request-refund', {
reason: input.reason,
additionalComments: input.additionalComments || '',
});

if (error) {
return { success: false, error: error.message };
}

return data || { success: true, message: 'Refund request submitted.' };
} catch (err) {
console.error('Error requesting billing refund:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error'
};
}
}

/**
* Get user's refund requests
*/
export async function getUserRefundRequests(): Promise<{
success: boolean;
data?: RefundRequest[];
error?: string
}> {
try {
const { data: user } = await apiClient.auth.getUser();
if (!user) {
return { success: false, error: 'User not authenticated' };
}

const { data, error } = await apiClient
.from('refund_requests')
.select('*')
.eq('user_id', user.id)
.order('created_at', { ascending: false });

if (error) {
console.error('Error fetching refund requests:', error);
return { success: false, error: error.message };
}

return { success: true, data: data as RefundRequest[] };
} catch (err) {
console.error('Error fetching refund requests:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error'
};
}
}

/**
* Get pending refund requests for admin
*/
export async function getPendingRefundRequests(): Promise<{
success: boolean;
data?: AdminRefundRequest[];
error?: string
}> {
try {
const { data, error } = await apiClient
.rpc('get_pending_refund_requests', {});

if (error) {
console.error('Error fetching pending refunds:', error);
return { success: false, error: error.message };
}

return { success: true, data: data as AdminRefundRequest[] };
} catch (err) {
console.error('Error fetching pending refunds:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error'
};
}
}

/**
* Approve a refund request (admin only)
*/
export async function approveRefundRequest(
refundId: string,
adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
try {
const { data: user } = await apiClient.auth.getUser();
if (!user) {
return { success: false, error: 'User not authenticated' };
}

const { error } = await apiClient
.rpc('process_refund_approval', {
refundId,
adminUserId: user.id,
adminNotes: adminNotes || null,
});

if (error) {
console.error('Error approving refund:', error);
return { success: false, error: error.message };
}

return { success: true };
} catch (err) {
console.error('Error approving refund:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error'
};
}
}

/**
* Deny a refund request (admin only)
*/
export async function denyRefundRequest(
refundId: string,
adminNotes: string
): Promise<{ success: boolean; error?: string }> {
try {
const { data: user } = await apiClient.auth.getUser();
if (!user) {
return { success: false, error: 'User not authenticated' };
}

const { error } = await apiClient
.rpc('deny_refund_request', {
refundId,
adminUserId: user.id,
adminNotes,
});

if (error) {
console.error('Error denying refund:', error);
return { success: false, error: error.message };
}

return { success: true };
} catch (err) {
console.error('Error denying refund:', err);
return {
success: false,
error: err instanceof Error ? err.message : 'Unknown error'
};
}
}

/**
* Calculate refund eligibility locally (for preview before submitting)
*/
export function calculateRefundEligibility(
purchaseDate: Date,
questionsCompleted: number,
mockInterviewsCompleted: number
): RefundEligibility {
const now = new Date();
const daysSincePurchase = Math.floor(
(now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
);

let isEligible = true;
let reason = 'Within refund window and usage limits';

if (daysSincePurchase > 7) {
isEligible = false;
reason = 'Refund window expired (over 7 days)';
} else if (questionsCompleted >= 25) {
isEligible = false;
reason = 'Exceeded usage limit (25+ questions)';
} else if (mockInterviewsCompleted > 1) {
isEligible = false;
reason = 'Exceeded usage limit (more than 1 mock interview)';
}

return {
daysSincePurchase,
questionsCompleted,
mockInterviewsCompleted,
isEligible,
reason,
};
}
