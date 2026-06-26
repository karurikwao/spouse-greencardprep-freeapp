import { useEffect } from 'react';

export function useCaptureReferralOnMount(): void {
  useEffect(() => {
    void import('@/lib/promo').then(({ captureReferralFromUrl }) => {
      captureReferralFromUrl();
    });
  }, []);
}
