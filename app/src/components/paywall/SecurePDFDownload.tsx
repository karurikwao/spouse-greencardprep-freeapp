/**
 * Secure PDF Download Component
 * 
 * Free-app PDF download button with signed delivery and a simple practice
 * disclaimer. Users must be signed in, but PDFs are no longer premium-gated.
 */

import { useState } from 'react';
import { AlertCircle, Download, ExternalLink, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { requestSecurePDFAccess, downloadPDFWithSignedUrl } from '@/lib/downloads/secureAccess';
import {
  fetchPublicPdfDownloadOffer,
  trackPdfDownloadOfferEvent,
  type PdfDownloadSource,
  type PublicPdfDownloadOffer,
} from '@/lib/downloads/pdfOffer';
import { cn } from '@/lib/utils';
import { AuthModal } from '@/components/auth/AuthModal';
import { RichMessageContent } from '@/components/messages/RichMessageContent';

interface SecurePDFDownloadProps {
  /** PDF file name (e.g., "Kitchen_Household_Interview_Practice_Questions.pdf") */
  pdfFileName: string;
  /** Display title for the PDF */
  pdfTitle: string;
  /** Optional topic ID for tracking */
  topicId?: string;
  /** Optional category ID for tracking */
  categoryId?: string;
  /** Download source for analytics */
  source?: PdfDownloadSource;
  /** Visual variant */
  variant?: 'button' | 'link' | 'icon';
  /** Button size if variant is 'button' */
  size?: 'default' | 'sm' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Called when download is initiated (after entitlement check passes) */
  onDownload?: () => void;
  /** Called when user clicks but doesn't have access */
  onBlocked?: () => void;
  /** Whether to show label or just icon */
  showLabel?: boolean;
  /** Custom label text */
  label?: string;
}

const PDF_TERMS_STORAGE_KEY = 'spouse-interview-pdf-terms-accepted-v1';
const PDF_OFFER_STORAGE_PREFIX = 'spouse-interview-pdf-offer-seen-v1';

function hasAcceptedPdfTerms() {
  try {
    return window.localStorage.getItem(PDF_TERMS_STORAGE_KEY) === 'accepted';
  } catch {
    return false;
  }
}

function savePdfTermsAccepted() {
  try {
    window.localStorage.setItem(PDF_TERMS_STORAGE_KEY, 'accepted');
  } catch {
    // The user can continue even if private browsing blocks local storage.
  }
}

function offerStorageKey(source: PdfDownloadSource, offer: PublicPdfDownloadOffer) {
  const fingerprint = `${source}:${offer.title}:${offer.ctaUrl}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 120);
  return `${PDF_OFFER_STORAGE_PREFIX}:${fingerprint || source}`;
}

function shouldShowOffer(source: PdfDownloadSource, offer: PublicPdfDownloadOffer) {
  if (offer.frequency === 'always') return true;
  const key = offerStorageKey(source, offer);
  try {
    if (offer.frequency === 'once_per_day') {
      return window.localStorage.getItem(key) !== new Date().toISOString().slice(0, 10);
    }
    return window.sessionStorage.getItem(key) !== 'seen';
  } catch {
    return true;
  }
}

function markOfferSeen(source: PdfDownloadSource, offer: PublicPdfDownloadOffer) {
  const key = offerStorageKey(source, offer);
  try {
    if (offer.frequency === 'once_per_day') {
      window.localStorage.setItem(key, new Date().toISOString().slice(0, 10));
      return;
    }
    if (offer.frequency === 'once_per_session') {
      window.sessionStorage.setItem(key, 'seen');
    }
  } catch {
    // Storage is only a frequency helper. It should never block PDF access.
  }
}

/**
 * Secure PDF Download Button/Link
 * 
 * Uses short-lived signed URLs and a one-time practice-materials disclaimer.
 */
export function SecurePDFDownload({
  pdfFileName,
  pdfTitle,
  topicId,
  categoryId,
  variant = 'button',
  size = 'default',
  className,
  source = 'topic_page',
  onDownload,
  onBlocked,
  showLabel = true,
  label = 'Download PDF',
}: SecurePDFDownloadProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [offer, setOffer] = useState<PublicPdfDownloadOffer | null>(null);
  const [showOffer, setShowOffer] = useState(false);

  const startSecureDownload = async () => {
    // User has access - request secure download
    setErrorMessage(null);
    setIsDownloading(true);
    
    try {
      // Request signed URL from Edge Function
      const result = await requestSecurePDFAccess({
        fileKey: pdfFileName,
        topicId,
        categoryId,
        downloadSource: source,
      });

      if (!result.success) {
        const message = result.error || 'We could not prepare this PDF download. Please try again.';
        setErrorMessage(message);
        onBlocked?.();
        if (result.requiresSignIn) {
          setShowAuthModal(true);
        }
        return;
      }

      if (result.signedUrl) {
        // Download using signed URL
        downloadPDFWithSignedUrl(result.signedUrl, pdfFileName);
        onDownload?.();
        return;
      }

      setErrorMessage('We could not create the PDF link. Please try again.');
    } catch (err) {
      console.error('Error downloading PDF:', err);
      setErrorMessage(err instanceof Error ? err.message : 'We could not prepare this PDF download. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const prepareDownload = async () => {
    setErrorMessage(null);
    setIsPreparing(true);
    try {
      const nextOffer = await fetchPublicPdfDownloadOffer(source);
      if (nextOffer && shouldShowOffer(source, nextOffer)) {
        setOffer(nextOffer);
        setShowOffer(true);
        trackPdfDownloadOfferEvent(source, nextOffer, 'impression');
        return;
      }
    } catch {
      // Sponsored offers are optional. If unavailable, PDF access continues normally.
    } finally {
      setIsPreparing(false);
    }

    await startSecureDownload();
  };

  const handleClick = async () => {
    if (!hasAcceptedPdfTerms()) {
      setTermsAccepted(false);
      setShowTerms(true);
      return;
    }

    await prepareDownload();
  };

  const handleTermsContinue = async () => {
    if (!termsAccepted) return;
    savePdfTermsAccepted();
    setShowTerms(false);
    await prepareDownload();
  };

  const handleOfferCta = () => {
    if (!offer?.ctaUrl) return;
    markOfferSeen(source, offer);
    trackPdfDownloadOfferEvent(source, offer, 'cta_click', offer.ctaUrl);
    window.open(offer.ctaUrl, '_blank', 'noopener,noreferrer');
  };

  const handleOfferContinue = async () => {
    if (offer) {
      markOfferSeen(source, offer);
      trackPdfDownloadOfferEvent(source, offer, 'continued');
    }
    setShowOffer(false);
    await startSecureDownload();
  };

  const handleOfferOpenChange = (isOpen: boolean) => {
    if (!isOpen && showOffer && offer) {
      markOfferSeen(source, offer);
      trackPdfDownloadOfferEvent(source, offer, 'dismissed');
    }
    setShowOffer(isOpen);
  };

  const isBusy = isDownloading || isPreparing;
  const busyText = isPreparing ? 'Preparing...' : 'Downloading...';
  const feedback = errorMessage ? (
    <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold leading-5 text-rose-700">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{errorMessage}</span>
    </p>
  ) : null;

  const termsDialog = (
    <Dialog open={showTerms} onOpenChange={setShowTerms}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <FileText className="h-5 w-5" />
          </div>
          <DialogTitle>Review PDF access terms</DialogTitle>
          <DialogDescription>
            These study files are free practice materials for signed-in Spouse Interview users.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2 text-sm leading-6 text-slate-700">
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
            <p className="font-semibold text-slate-950">Before opening {pdfTitle}</p>
            <p className="mt-1">
              Use these materials for personal interview practice only. Spouse Interview is not a law firm,
              does not provide legal advice, and does not replace help from a qualified immigration professional.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
            <p className="font-semibold text-emerald-950">Free-app access</p>
            <p className="mt-1">
              PDF access is included in the free app. Downloads may be logged for abuse prevention,
              basic analytics, and improving the study library.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <Checkbox
              id={`pdf-terms-${pdfFileName}`}
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              className="mt-1"
            />
            <Label htmlFor={`pdf-terms-${pdfFileName}`} className="cursor-pointer text-sm font-medium leading-6 text-slate-800">
              I have read and understand these terms for accessing Spouse Interview PDF practice materials.
            </Label>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setShowTerms(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleTermsContinue}
            disabled={!termsAccepted || isDownloading}
            className="bg-gradient-to-r from-blue-700 to-cyan-700 font-extrabold text-white"
          >
            {isDownloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            Access PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const offerDialog = (
    <Dialog open={showOffer} onOpenChange={handleOfferOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <div className="mb-1 inline-flex w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-emerald-800">
            {offer?.disclosureLabel || 'Sponsored Resource'}
          </div>
          <DialogTitle>{offer?.title || 'Before you download'}</DialogTitle>
          <DialogDescription>
            Review this resource, then continue to your PDF.
          </DialogDescription>
        </DialogHeader>
        {offer?.bodyHtml && (
          <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
            <RichMessageContent
              content={offer.bodyHtml}
              onLinkClick={(href) => {
                if (offer) {
                  trackPdfDownloadOfferEvent(source, offer, 'body_link_click', href);
                }
              }}
            />
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (offer) {
                markOfferSeen(source, offer);
                trackPdfDownloadOfferEvent(source, offer, 'dismissed');
              }
              setShowOffer(false);
            }}
          >
            Not now
          </Button>
          {offer?.ctaUrl && (
            <Button variant="outline" onClick={handleOfferCta}>
              <ExternalLink className="mr-2 h-4 w-4" />
              {offer.ctaLabel || 'Open resource'}
            </Button>
          )}
          <Button
            onClick={handleOfferContinue}
            disabled={isDownloading}
            className="bg-gradient-to-r from-blue-700 to-cyan-700 font-extrabold text-white"
          >
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isDownloading ? 'Preparing PDF...' : offer?.continueLabel || 'Continue to PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={handleClick}
          disabled={isBusy}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          title={`Download ${pdfTitle}`}
        >
          {isBusy ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : (
            <Download className="w-4 h-4 text-slate-600" />
          )}
        </button>
        {feedback}
        {termsDialog}
        {offerDialog}
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} defaultTab="signup" />
      </>
    );
  }

  if (variant === 'link') {
    return (
      <>
        <button
          onClick={handleClick}
          disabled={isBusy}
          className={cn(
            'inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium',
            className
          )}
        >
          {isBusy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {showLabel && (isBusy ? busyText : label)}
        </button>
        {feedback}
        {termsDialog}
        {offerDialog}
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} defaultTab="signup" />
      </>
    );
  }

  // Button variant (default)
  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={handleClick}
        disabled={isBusy}
        className={className}
      >
        {isBusy ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Download className="w-4 h-4 mr-2" />
        )}
        {showLabel && (isBusy ? busyText : label)}
      </Button>
      {feedback}
      {termsDialog}
      {offerDialog}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} defaultTab="signup" />
    </>
  );
}

export default SecurePDFDownload;
