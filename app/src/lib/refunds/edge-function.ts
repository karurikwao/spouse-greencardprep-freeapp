/**
* Edge Function Client for Processing Refunds
* Securely calls the server-side refund processing function
*/

import { apiClient, getToken } from '@/lib/apiClient';

interface RefundResponse {
  success: boolean;
  refundId?: string;
  message: string;
  error?: string;
}

/**
 * Process a refund via the secure edge function
 */
export async function processRefundViaEdgeFunction(
  refundRequestId: string,
  adminNotes?: string
): Promise<RefundResponse> {
  try {
    const token = getToken();
    if (!token) {
      return {
        success: false,
        message: 'Not authenticated',
        error: 'Missing authentication',
      };
    }

    const { data, error } = await apiClient.invokeFunction<RefundResponse>('process-refund', {
      refundRequestId,
      adminNotes,
    });

    if (error) {
      return {
        success: false,
        message: data?.message || error.message || 'Refund processing failed',
        error: error.message,
      };
    }

    return (data as RefundResponse) || { success: true, message: 'Refund processed' };
  } catch (err) {
    console.error('Error calling refund edge function:', err);
    return {
      success: false,
      message: 'Failed to process refund',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
