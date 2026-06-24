import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, CreditCard, Loader2, RefreshCw, ShieldCheck, WalletCards, Bot } from 'lucide-react';
import { VirtualAgentPanel } from '@/components/dashboard/VirtualAgentPanel';
import { AdPlacement } from '@/components/ads';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOptionalAuth } from '@/lib/auth/AuthContext';
import {
  confirmRobinCreditCheckout,
  fetchRobinCreditPacks,
  fetchRobinCreditSummary,
  startRobinCreditCheckout,
  type RobinCreditPack,
  type RobinCreditPackResponse,
  type RobinCreditSummary,
} from '@/lib/robinCredits';

interface RobinPageProps {
  onBack: () => void;
}

const creditCurrency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
});

function RobinCreditTopUpPanel({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [packResponse, setPackResponse] = useState<RobinCreditPackResponse | null>(null);
  const [credits, setCredits] = useState<RobinCreditSummary | null>(null);
  const [isLoadingPacks, setIsLoadingPacks] = useState(true);
  const [isRefreshingCredits, setIsRefreshingCredits] = useState(false);
  const [isConfirmingCheckout, setIsConfirmingCheckout] = useState(false);
  const [purchasingPackId, setPurchasingPackId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visiblePacks = useMemo(() => {
    if (!packResponse?.checkoutEnabled) return [];
    return packResponse.packs || [];
  }, [packResponse]);

  const refreshCredits = useCallback(async () => {
    if (!isAuthenticated) {
      setCredits(null);
      return;
    }

    setIsRefreshingCredits(true);
    try {
      setCredits(await fetchRobinCreditSummary());
    } catch {
      setCredits(null);
    } finally {
      setIsRefreshingCredits(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let isMounted = true;

    const loadPacks = async () => {
      setIsLoadingPacks(true);
      try {
        const response = await fetchRobinCreditPacks();
        if (isMounted) setPackResponse(response);
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : 'Unable to load Robin credit packs');
      } finally {
        if (isMounted) setIsLoadingPacks(false);
      }
    };

    loadPacks();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get('credits');
    const sessionId = params.get('session_id');

    if (checkoutStatus === 'cancelled') {
      setNotice('Checkout was cancelled. No Robin credits were added.');
      return;
    }

    if (checkoutStatus !== 'success') return;

    setNotice('Payment confirmed. Updating your Robin credit balance...');
    if (!isAuthenticated || !sessionId) {
      refreshCredits();
      return;
    }

    let isMounted = true;
    const confirmCheckout = async () => {
      setIsConfirmingCheckout(true);
      try {
        const summary = await confirmRobinCreditCheckout(sessionId);
        if (!isMounted) return;
        if (summary) setCredits(summary);
        setNotice('Your Robin credits are ready.');
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Unable to confirm Robin credit purchase');
        refreshCredits();
      } finally {
        if (isMounted) setIsConfirmingCheckout(false);
      }
    };

    confirmCheckout();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, refreshCredits]);

  const handlePurchase = async (pack: RobinCreditPack) => {
    setError(null);
    setNotice(null);

    if (!isAuthenticated) {
      setNotice('Sign in to buy and save extra Robin messages.');
      return;
    }

    setPurchasingPackId(pack.id);
    try {
      window.location.href = await startRobinCreditCheckout(pack.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start checkout');
      setPurchasingPackId(null);
    }
  };

  const hasCreditBalance = isAuthenticated && Boolean(credits) && (credits?.balance || 0) > 0;
  const shouldShowPanel = hasCreditBalance || visiblePacks.length > 0 || notice || error;

  if (!shouldShowPanel && !isLoadingPacks) return null;
  if (!shouldShowPanel && isLoadingPacks) return null;

  return (
    <section className="rounded-3xl border-2 border-amber-200 bg-white p-5 shadow-xl shadow-amber-100/70">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
            <WalletCards className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-amber-700">Robin credits</p>
            <h2 className="text-xl font-extrabold text-slate-950">Extra messages after daily free usage</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-700">
              Daily free Robin messages are used first. Optional credits are one-time top-ups and are consumed only after the free daily messages run out.
            </p>
          </div>
        </div>

        {isAuthenticated && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-left lg:min-w-52">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">Extra balance</p>
                <p className="text-2xl font-extrabold text-slate-950">{(credits?.balance || 0).toLocaleString()}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={refreshCredits}
                disabled={isRefreshingCredits}
                className="text-emerald-800 hover:bg-emerald-100"
                aria-label="Refresh Robin credit balance"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshingCredits ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {(notice || error || isConfirmingCheckout) && (
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
          error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
        }`}>
          <div className="flex items-center gap-2">
            {error ? <CreditCard className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>{error || notice}</span>
            {isConfirmingCheckout && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </div>
      )}

      {visiblePacks.length > 0 && (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {visiblePacks.map((pack) => {
            const isPurchasing = purchasingPackId === pack.id;
            return (
              <div key={pack.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-950">{pack.label}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{pack.messages.toLocaleString()} extra messages</p>
                  </div>
                  <Badge className="border-0 bg-white text-amber-800 shadow-sm">
                    {creditCurrency.format(pack.priceCents / 100)}
                  </Badge>
                </div>
                <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                  Expires after {pack.expirationDays.toLocaleString()} days. {pack.rollover ? 'Unused paid credits can roll over inside that window.' : 'Unused credits do not roll over.'}
                </p>
                <Button
                  type="button"
                  onClick={() => handlePurchase(pack)}
                  disabled={Boolean(purchasingPackId)}
                  className="mt-4 w-full bg-slate-950 font-extrabold text-white hover:bg-slate-800"
                >
                  {isPurchasing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                  {isAuthenticated ? 'Buy Credits' : 'Sign In to Buy'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function RobinPage({ onBack }: RobinPageProps) {
  const { isAuthenticated, user } = useOptionalAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-cyan-50 pb-16 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-indigo-100 bg-white/95 shadow-sm shadow-indigo-100/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="text-indigo-800 hover:bg-indigo-50 hover:text-indigo-950"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-700 to-cyan-600 text-white shadow-lg shadow-indigo-200 sm:flex">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">Robin Practice</p>
                <h1 className="text-xl font-extrabold text-slate-950 sm:text-2xl">Chat with Robin</h1>
              </div>
            </div>
          </div>
          <Badge className="hidden border-0 bg-emerald-100 px-3 py-1.5 text-emerald-800 sm:inline-flex">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            {isAuthenticated ? user?.email || 'Signed in' : 'Sign in to save memory'}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <section className="overflow-hidden rounded-3xl border-2 border-indigo-200 bg-gradient-to-r from-white via-indigo-50 to-cyan-50 p-5 shadow-xl shadow-indigo-100/70">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-950">Robin keeps your practice conversations organized</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-700">
                Ask immigration interview questions, relationship-practice questions, attorney-resource questions,
                and preparation questions in one dedicated chat area. Answers are grouped by date and indexed into
                your memory bank for later review.
              </p>
            </div>
          </div>
        </section>

        <AdPlacement placement="robin.inline" />

        <RobinCreditTopUpPanel isAuthenticated={isAuthenticated} />

        <VirtualAgentPanel mode="page" />
      </main>
    </div>
  );
}
