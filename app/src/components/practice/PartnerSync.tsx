/**
 * Partner Sync Component
 * Allows couples to connect and study together
 */

import { useState, useEffect } from 'react';
import { 
  Users, 
  Link2, 
  Unlink, 
  Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
// Additional UI components available for future use
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useOptionalAuth } from '@/lib/auth/AuthContext';
import { 
  sendPartnerRequest, 
  getPartnerConnection,
  getPartnerProgress,
  getSyncSettings,
  updateSyncSettings,
  disconnectPartner,
  type PartnerConnection,
  type PartnerProgress,
  type SyncSettings
} from '@/lib/practice/partnerSync';
import { cn } from '@/lib/utils';

export function PartnerSync() {
  const { isAuthenticated } = useOptionalAuth();
  const [partnerEmail, setPartnerEmail] = useState('');
  const [connection, setConnection] = useState<PartnerConnection | null>(null);
  const [partnerProgress, setPartnerProgress] = useState<PartnerProgress | null>(null);
  const [settings, setSettings] = useState<SyncSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadConnection();
    }
  }, [isAuthenticated]);

  const loadConnection = async () => {
    const conn = await getPartnerConnection();
    setConnection(conn);

    if (conn) {
      const [progress, syncSettings] = await Promise.all([
        getPartnerProgress(conn.partnerId),
        getSyncSettings(),
      ]);
      setPartnerProgress(progress);
      setSettings(syncSettings);
    }
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const result = await sendPartnerRequest(partnerEmail);

    if (result.success) {
      setMessage({ type: 'success', text: 'Partner request sent!' });
      setPartnerEmail('');
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to send request' });
    }

    setIsLoading(false);
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    
    setIsLoading(true);
    const success = await disconnectPartner(connection.id);
    
    if (success) {
      setConnection(null);
      setPartnerProgress(null);
      setMessage({ type: 'success', text: 'Partner disconnected' });
    } else {
      setMessage({ type: 'error', text: 'Failed to disconnect' });
    }
    
    setIsLoading(false);
  };

  const handleUpdateSettings = async (newSettings: Partial<SyncSettings>) => {
    const updated = { ...settings, ...newSettings } as SyncSettings;
    setSettings(updated);
    await updateSyncSettings(newSettings);
  };

  if (!isAuthenticated) {
    return (
      <Card className="border-slate-200/60">
        <CardContent className="p-6 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-800 mb-2">Study with Your Partner</h3>
          <p className="text-slate-500 mb-4">
            Connect with your spouse to track each other's progress and study together.
          </p>
          <p className="text-sm text-slate-400">
            Sign in to use this feature
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200/60">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-slate-600" />
          <CardTitle className="text-base">Partner Sync</CardTitle>
        </div>
        <CardDescription>
          Study together and track each other's progress
        </CardDescription>
      </CardHeader>

      <CardContent>
        {message && (
          <Alert 
            className={cn(
              "mb-4",
              message.type === 'success' ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
            )}
          >
            <AlertDescription className={message.type === 'success' ? "text-emerald-800" : "text-red-800"}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {connection ? (
          <div className="space-y-6">
            {/* Connected Partner Info */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-medium text-slate-800">
                    {connection.partnerName || connection.partnerEmail}
                  </span>
                </div>
                <span className="text-sm text-slate-500">Connected</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={isLoading}
                className="text-red-600 hover:text-red-700"
              >
                <Unlink className="w-4 h-4 mr-1" />
                Disconnect
              </Button>
            </div>

            {/* Partner Progress */}
            {partnerProgress && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-700">Partner's Activity</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg text-center">
                    <div className="text-2xl font-medium text-slate-800">
                      {Object.keys(partnerProgress.questionStates).length}
                    </div>
                    <div className="text-xs text-slate-500">Questions reviewed</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg text-center">
                    <div className="text-2xl font-medium text-slate-800">
                      {partnerProgress.currentTopic ? 'Active' : 'Idle'}
                    </div>
                    <div className="text-xs text-slate-500">Current status</div>
                  </div>
                </div>
              </div>
            )}

            {/* Sync Settings */}
            {settings && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h4 className="text-sm font-medium text-slate-700">Sharing Settings</h4>
                <div className="space-y-3">
                  <SettingSwitch
                    label="Share progress"
                    description="Let your partner see which questions you've reviewed"
                    checked={settings.shareProgress}
                    onChange={(v) => handleUpdateSettings({ shareProgress: v })}
                  />
                  <SettingSwitch
                    label="Share saved questions"
                    description="Share your saved questions list"
                    checked={settings.shareSavedQuestions}
                    onChange={(v) => handleUpdateSettings({ shareSavedQuestions: v })}
                  />
                  <SettingSwitch
                    label="Share statistics"
                    description="Share your comfort level breakdown"
                    checked={settings.shareStats}
                    onChange={(v) => handleUpdateSettings({ shareStats: v })}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSendRequest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="partner-email">Partner's Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="partner-email"
                  type="email"
                  placeholder="partner@example.com"
                  value={partnerEmail}
                  onChange={(e) => setPartnerEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-xs text-slate-400">
                Your partner must have an account to connect
              </p>
            </div>

            <Button
              type="submit"
              className="w-full bg-slate-700 hover:bg-slate-800"
              disabled={isLoading}
            >
              <Link2 className="w-4 h-4 mr-2" />
              {isLoading ? 'Sending...' : 'Send Connection Request'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function SettingSwitch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-slate-700">{label}</div>
        <div className="text-xs text-slate-400">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
