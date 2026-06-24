const API_URL = import.meta.env.VITE_API_URL || '';

export type PdfDownloadSource =
  | 'topic_page'
  | 'practice_mode'
  | 'practice_completion'
  | 'direct_link'
  | 'seo_page'
  | 'pdf_library';

export type PdfOfferFrequency = 'always' | 'once_per_session' | 'once_per_day';

export interface PublicPdfDownloadOffer {
  enabled: boolean;
  offerId: string;
  disclosureLabel: string;
  title: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  continueLabel: string;
  frequency: PdfOfferFrequency;
}

export type PdfOfferEventType = 'impression' | 'cta_click' | 'body_link_click' | 'dismissed' | 'continued';

export async function fetchPublicPdfDownloadOffer(
  source: PdfDownloadSource
): Promise<PublicPdfDownloadOffer | null> {
  const response = await fetch(
    `${API_URL}/api/pdf-download-offer/public?source=${encodeURIComponent(source)}`
  );
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || response.statusText || 'Unable to load PDF offer');
  }

  const offer = payload.offer as Partial<PublicPdfDownloadOffer> | undefined;
  if (!offer?.enabled) return null;

  return {
    enabled: true,
    offerId: offer.offerId || `${source}-${offer.title || 'offer'}`,
    disclosureLabel: offer.disclosureLabel || 'Sponsored Resource',
    title: offer.title || 'Before you download',
    bodyHtml: offer.bodyHtml || '',
    ctaLabel: offer.ctaLabel || 'Open sponsored resource',
    ctaUrl: offer.ctaUrl || '',
    continueLabel: offer.continueLabel || 'Continue to PDF',
    frequency: offer.frequency || 'once_per_session',
  };
}

export function trackPdfDownloadOfferEvent(
  source: PdfDownloadSource,
  offer: Pick<PublicPdfDownloadOffer, 'offerId'>,
  eventType: PdfOfferEventType,
  targetUrl?: string
) {
  fetch(`${API_URL}/api/pdf-download-offer/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source,
      offerId: offer.offerId,
      eventType,
      targetUrl,
    }),
  }).catch(() => {
    // Analytics must never block PDF access.
  });
}
