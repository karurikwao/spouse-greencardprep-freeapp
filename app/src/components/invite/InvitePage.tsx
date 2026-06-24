/**
 * Invite Page
 * Handles partner invitation codes and linking accounts
 */

import { useState, useEffect } from 'react';
import { 
  Users, 
  Link2, 
  CheckCircle, 
  AlertCircle,
  ArrowLeft,
  Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthModal } from '@/components/auth/AuthModal';
import { useOptionalAuth } from '@/lib/auth/AuthContext';
import { 
  acceptPartnerRequest, 
  getPartnerConnection,
  type PartnerConnection
} from '@/lib/practice/partnerSync';
import { cn } from '@/lib/utils';

interface InvitePageProps {
  inviteCode: string;
  onBack: () => void;
}

export function InvitePage({ inviteCode, onBack }: InvitePageProps) {
  const { isAuthenticated } = useOptionalAuth();
  const [status, setStatus] = useState<'loading' | 'pending' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [connection, setConnection] = useState<PartnerConnection | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (!inviteCode) {
      setStatus('error');
      setMessage('Invalid invite code');
      return;
    }

    if (!isAuthenticated) {
      setStatus('pending');
      setMessage('Please sign in to accept this invitation');
      return;
    }

    // Try to accept the invitation
    handleAcceptInvite();
  }, [inviteCode, isAuthenticated]);

  const handleAcceptInvite = async () => {
    setStatus('loading');
    
    const result = await acceptPartnerRequest(inviteCode);
    
    if (result.success) {
      setStatus('success');
      setMessage('You are now connected with your partner!');
      
      // Fetch connection details
      const conn = await getPartnerConnection();
      setConnection(conn);
    } else {
      setStatus('error');
      setMessage(result.error || 'Failed to accept invitation');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/50 to-slate-50/50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Heart className="w-6 h-6 text-rose-500" />
              <h1 className="text-xl font-semibold text-slate-800">Partner Invitation</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <Card className="border-slate-200/60">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-rose-500" />
            </div>
            <CardTitle className="text-2xl">Couple Practice</CardTitle>
            <CardDescription>
              Connect with your partner to practice together and track each other&apos;s progress
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Status Alert */}
            {status === 'loading' && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
              </div>
            )}

            {status === 'pending' && !isAuthenticated && (
              <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  {message}
                </AlertDescription>
              </Alert>
            )}

            {status === 'error' && (
              <Alert className="bg-rose-50 border-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <AlertDescription className="text-rose-800">
                  {message}
                </AlertDescription>
              </Alert>
            )}

            {status === 'success' && (
              <Alert className="bg-emerald-50 border-emerald-200">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <AlertDescription className="text-emerald-800">
                  {message}
                </AlertDescription>
              </Alert>
            )}

            {/* Connection Details */}
            {connection && (
              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <h3 className="font-medium text-slate-700 flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Connection Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Partner:</span>
                    <span className="text-slate-700">{connection.partnerName || connection.partnerEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className={cn(
                      'capitalize',
                      connection.status === 'connected' ? 'text-emerald-600' : 'text-amber-600'
                    )}>
                      {connection.status}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3">
              {status === 'pending' && !isAuthenticated && (
                <Button 
                  className="w-full bg-rose-500 hover:bg-rose-600"
                  onClick={() => setShowAuthModal(true)}
                >
                  Sign In to Accept
                </Button>
              )}
              
              {status === 'success' && (
                <Button 
                  className="w-full bg-slate-700 hover:bg-slate-800"
                  onClick={onBack}
                >
                  Go to Dashboard
                </Button>
              )}
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={onBack}
              >
                Back to Home
              </Button>
            </div>

            {/* Info */}
            <div className="text-center text-sm text-slate-500">
              <p>Once connected, you and your partner can:</p>
              <ul className="mt-2 space-y-1">
                <li>• See each other&apos;s readiness scores</li>
                <li>• Compare comfort levels on questions</li>
                <li>• Track combined progress</li>
                <li>• Identify areas to practice together</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultTab="login"
      />
    </div>
  );
}
