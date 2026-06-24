import { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  BarChart3, 
  Network, 
  LogOut, 
  Eye, 
  EyeOff, 
  Save, 
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  ChevronDown,
  ChevronUp,
  FileText,
  Code2
} from 'lucide-react';
// import { ContentManager } from '@/components/admin/content/ContentManager';
// import { VerificationCodeTab } from '@/components/admin/verification/VerificationCodeTab';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  signInWithEmail,
  signOut,
  resetPassword,
  checkIsAdmin,
  getAdSettings,
  updateAdSettings,
  getDownloadStats,
  resetStats,
  supabase
} from '@/lib/supabase';
import { defaultAdminSettings, type AdminSettings, type AdNetwork } from '@/data/admin';
import {
  getAnnouncements,
  getContentBlocks,
  getTrustSnippets,
  getPlacementLabel,
  getStatusLabel,
  type Announcement,
  type ContentBlock,
  type TrustSnippet,
} from '@/lib/content/api';
import {
  getAllVerificationCodes,
  getPlacementDescription,
  getPlacementLabel as getVerificationPlacementLabel,
  getPlacementWarning,
  updateVerificationCode,
  validateCodeContent,
  validateVerificationCode,
  type VerificationEnvironment,
  type VerificationPlacement,
} from '@/lib/verification/api';

interface AdminPanelProps {
  onClose: () => void;
}

const VERIFICATION_PLACEMENTS: VerificationPlacement[] = ['head', 'footer', 'body_end'];

type ContentSummary = {
  announcements: Announcement[];
  trustSnippets: TrustSnippet[];
  blocks: ContentBlock[];
};

function countByStatus(items: Array<{ status: string }>, status: string) {
  return items.filter((item) => item.status === status).length;
}

function ContentManagementTab() {
  const [summary, setSummary] = useState<ContentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const loadContent = async () => {
    setIsLoading(true);
    setMessage(null);

    const [announcementsResult, snippetsResult, blocksResult] = await Promise.all([
      getAnnouncements(),
      getTrustSnippets(),
      getContentBlocks(),
    ]);

    const firstError = announcementsResult.error || snippetsResult.error || blocksResult.error;
    if (firstError) {
      setMessage(firstError.message || 'Unable to load content records.');
    }

    setSummary({
      announcements: announcementsResult.data || [],
      trustSnippets: snippetsResult.data || [],
      blocks: blocksResult.data || [],
    });
    setIsLoading(false);
  };

  useEffect(() => {
    loadContent();
  }, []);

  if (isLoading) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p>Loading content controls...</p>
      </div>
    );
  }

  const announcements = summary?.announcements || [];
  const snippets = summary?.trustSnippets || [];
  const blocks = summary?.blocks || [];
  const allItems = [...announcements, ...snippets, ...blocks];
  const recentItems = allItems
    .slice()
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-4">
      {message && (
        <div className="flex items-center gap-2 text-sm p-3 rounded-lg text-amber-700 bg-amber-50">
          <AlertCircle className="h-4 w-4" />
          {message}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Items</CardDescription>
            <CardTitle className="text-2xl">{allItems.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Published</CardDescription>
            <CardTitle className="text-2xl">{countByStatus(allItems, 'published')}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Drafts</CardDescription>
            <CardTitle className="text-2xl">{countByStatus(allItems, 'draft')}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Archived</CardDescription>
            <CardTitle className="text-2xl">{countByStatus(allItems, 'archived')}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Site Content Inventory</CardTitle>
              <CardDescription>Announcements, trust snippets, and content blocks currently stored for the app.</CardDescription>
            </div>
            <Button onClick={loadContent} variant="outline" size="sm">
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentItems.length > 0 ? (
            recentItems.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="font-medium text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-500">
                    {getPlacementLabel(item.placement)} - updated {new Date(item.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={item.status === 'published' ? 'default' : 'secondary'}>
                  {getStatusLabel(item.status)}
                </Badge>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">
              <p>No CMS content has been added yet.</p>
              <p className="text-sm">The public app still uses its bundled page copy and topic data.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VerificationCodesTab() {
  const [environment, setEnvironment] = useState<VerificationEnvironment>('production');
  const [codes, setCodes] = useState<Record<VerificationPlacement, VerificationCodeInputState>>({
    head: { code: '', notes: '', is_enabled: false },
    footer: { code: '', notes: '', is_enabled: false },
    body_end: { code: '', notes: '', is_enabled: false },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [savingPlacement, setSavingPlacement] = useState<VerificationPlacement | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadCodes = async (nextEnvironment = environment) => {
    setIsLoading(true);
    setMessage(null);
    const rows = await getAllVerificationCodes(nextEnvironment);
    const nextCodes: Record<VerificationPlacement, VerificationCodeInputState> = {
      head: { code: '', notes: '', is_enabled: false },
      footer: { code: '', notes: '', is_enabled: false },
      body_end: { code: '', notes: '', is_enabled: false },
    };

    rows.forEach((row) => {
      nextCodes[row.placement] = {
        code: row.code,
        notes: row.notes || '',
        is_enabled: row.is_enabled,
      };
    });

    setCodes(nextCodes);
    setIsLoading(false);
  };

  useEffect(() => {
    loadCodes(environment);
  }, [environment]);

  const updateDraft = (placement: VerificationPlacement, updates: Partial<VerificationCodeInputState>) => {
    setCodes((current) => ({
      ...current,
      [placement]: {
        ...current[placement],
        ...updates,
      },
    }));
  };

  const saveCode = async (placement: VerificationPlacement) => {
    const draft = codes[placement];
    const validationError = validateVerificationCode({
      placement,
      environment,
      code: draft.code,
      notes: draft.notes,
      is_enabled: draft.is_enabled,
    });

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setSavingPlacement(placement);
    setMessage(null);
    const result = await updateVerificationCode({
      placement,
      environment,
      code: draft.code,
      notes: draft.notes,
      is_enabled: draft.is_enabled,
    });

    if (result.success) {
      setMessage(`${getVerificationPlacementLabel(placement)} saved.`);
      await loadCodes(environment);
    } else {
      setMessage(result.error || 'Unable to save verification code.');
    }
    setSavingPlacement(null);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p>Loading verification codes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="flex items-center gap-2 text-sm p-3 rounded-lg text-blue-700 bg-blue-50">
          <CheckCircle className="h-4 w-4" />
          {message}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Trusted Site Verification</h3>
          <p className="text-sm text-slate-500">Manage admin-entered snippets for search, analytics, and partner verification.</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 p-1">
          {(['production', 'test'] as VerificationEnvironment[]).map((item) => (
            <Button
              key={item}
              type="button"
              variant={environment === item ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setEnvironment(item)}
              className="capitalize"
            >
              {item}
            </Button>
          ))}
        </div>
      </div>

      {VERIFICATION_PLACEMENTS.map((placement) => {
        const draft = codes[placement];
        const validation = validateCodeContent(draft.code, placement);

        return (
          <Card key={placement}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">{getVerificationPlacementLabel(placement)}</CardTitle>
                  <CardDescription>{getPlacementDescription(placement)}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`enabled-${placement}`} className="text-sm">Enabled</Label>
                  <Switch
                    id={`enabled-${placement}`}
                    checked={draft.is_enabled}
                    onCheckedChange={(checked) => updateDraft(placement, { is_enabled: checked })}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-amber-700 bg-amber-50 rounded-md p-2">{getPlacementWarning(placement)}</p>
              <Textarea
                value={draft.code}
                onChange={(event) => updateDraft(placement, { code: event.target.value })}
                placeholder="Paste the trusted verification snippet here"
                className="min-h-28 font-mono text-xs"
              />
              <Input
                value={draft.notes}
                onChange={(event) => updateDraft(placement, { notes: event.target.value })}
                placeholder="Internal note"
              />
              {(validation.warnings.length > 0 || validation.suggestions.length > 0) && (
                <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                  {[...validation.warnings, ...validation.suggestions].map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={() => saveCode(placement)} disabled={savingPlacement === placement}>
                  {savingPlacement === placement ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

type VerificationCodeInputState = {
  code: string;
  notes: string;
  is_enabled: boolean;
};

export function AdminPanel({ onClose }: AdminPanelProps) {
  // Auth states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Settings states
  const [settings, setSettings] = useState<AdminSettings>(defaultAdminSettings);
  const [stats, setStats] = useState<any>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [expandedNetworks, setExpandedNetworks] = useState<Record<string, boolean>>({});

  // Check auth state on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (session) {
        setUserEmail(session.user.email || null);
        const adminStatus = await checkIsAdmin();
        setIsAdmin(adminStatus);
        setIsAuthenticated(true);
        if (adminStatus) {
          loadSettings();
          loadStats();
        }
      }
    };
    checkAuth();

    const handleStorage = () => {
      checkAuth();
    };
    window.addEventListener('storage', handleStorage);

    const interval = setInterval(checkAuth, 30000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  const loadSettings = async () => {
    const adSettings = await getAdSettings();
    if (adSettings) {
      setSettings(adSettings);
    }
  };

  const loadStats = async () => {
    const downloadStats = await getDownloadStats();
    if (downloadStats) {
      setStats(downloadStats);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError(null);

    const { data, error } = await signInWithEmail(email, password);
    
    if (error) {
      setAuthError(error.message);
      setIsLoading(false);
      return;
    }

    if (data.user) {
      const adminStatus = await checkIsAdmin();
      if (!adminStatus) {
        setAuthError('You do not have admin privileges.');
        await signOut();
        setIsLoading(false);
        return;
      }
      setIsAdmin(true);
      setIsAuthenticated(true);
      setUserEmail(data.user.email || null);
      loadSettings();
      loadStats();
    }
    setIsLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setAuthError('Please enter your email address first.');
      return;
    }
    setIsResettingPassword(true);
    setAuthError(null);
    setResetMessage(null);

    const { error } = await resetPassword(email);
    
    if (error) {
      setAuthError(error.message);
    } else {
      setResetMessage('Password reset email sent! Check your inbox.');
    }
    setIsResettingPassword(false);
  };

  const handleLogout = async () => {
    await signOut();
    setIsAuthenticated(false);
    setIsAdmin(false);
    setUserEmail(null);
    setEmail('');
    setPassword('');
  };

  const handleSaveSettings = async () => {
    setSaveMessage(null);
    const success = await updateAdSettings(settings);
    if (success) {
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } else {
      setSaveMessage('Failed to save settings.');
    }
  };

  const handleResetStats = async () => {
    if (confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
      const success = await resetStats();
      if (success) {
        loadStats();
        setSaveMessage('Statistics reset successfully!');
        setTimeout(() => setSaveMessage(null), 3000);
      }
    }
  };

  const toggleNetwork = (network: string) => {
    setExpandedNetworks(prev => ({
      ...prev,
      [network]: !prev[network]
    }));
  };

  const updateNetworkConfig = (network: AdNetwork, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      adConfigs: {
        ...prev.adConfigs,
        [network]: {
          ...prev.adConfigs[network],
          [field]: value
        }
      }
    }));
  };

  const toggleNetworkEnabled = (network: AdNetwork) => {
    const newEnabled = !settings.adConfigs[network].enabled;
    updateNetworkConfig(network, 'enabled', newEnabled);
    
    // Update active networks list
    setSettings(prev => {
      const activeNetworks = newEnabled 
        ? [...prev.activeNetworks, network]
        : prev.activeNetworks.filter(n => n !== network);
      return { ...prev, activeNetworks };
    });
  };

  // Login Form
  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close admin login"
          >
            <X className="h-5 w-5" />
          </button>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Admin Login</CardTitle>
            <CardDescription>
              Sign in with your admin credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              This panel is only for existing admin users. To create a regular user account, close this panel and use Sign up on the homepage.
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {authError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {authError}
                </div>
              )}

              {resetMessage && (
                <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-lg">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  {resetMessage}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>

              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isResettingPassword}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                {isResettingPassword ? 'Sending reset email...' : 'Forgot Password?'}
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader className="border-b bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Settings className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Admin Dashboard</CardTitle>
                <CardDescription className="text-xs">
                  Logged in as {userEmail}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="text-slate-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </CardHeader>

        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-slate-100 p-1 m-4 mb-0">
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="verification" className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              Verification
            </TabsTrigger>
            <TabsTrigger value="networks" className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              Networks
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Stats
            </TabsTrigger>
          </TabsList>

          <CardContent className="p-4 overflow-y-auto max-h-[60vh]">
            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4 mt-0">
              {saveMessage && (
                <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${saveMessage.includes('success') ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                  {saveMessage.includes('success') ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {saveMessage}
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white border rounded-lg">
                  <div>
                    <h4 className="font-semibold text-slate-900">Enable Ads</h4>
                    <p className="text-sm text-slate-500">Turn on advertising across the site</p>
                  </div>
                  <Switch
                    checked={settings.adsEnabled}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, adsEnabled: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-white border rounded-lg">
                  <div>
                    <h4 className="font-semibold text-slate-900">Interstitial Before Download</h4>
                    <p className="text-sm text-slate-500">Show ad before PDF downloads</p>
                  </div>
                  <Switch
                    checked={settings.interstitialBeforeDownload}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, interstitialBeforeDownload: checked }))}
                  />
                </div>

                <div className="p-4 bg-white border rounded-lg space-y-3">
                  <div>
                    <Label htmlFor="delay">Interstitial Delay (seconds)</Label>
                    <p className="text-sm text-slate-500 mb-2">Time before user can skip the ad</p>
                    <Input
                      id="delay"
                      type="number"
                      min={1}
                      max={30}
                      value={settings.interstitialDelay}
                      onChange={(e) => setSettings(prev => ({ ...prev, interstitialDelay: parseInt(e.target.value) || 5 }))}
                      className="w-32"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-white border rounded-lg">
                  <div>
                    <h4 className="font-semibold text-slate-900">Show Fallback Page</h4>
                    <p className="text-sm text-slate-500">Display empty page when no ads available</p>
                  </div>
                  <Switch
                    checked={settings.showEmptyPageFallback}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showEmptyPageFallback: checked }))}
                  />
                </div>

                <Button onClick={handleSaveSettings} className="w-full bg-blue-600 hover:bg-blue-700">
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </Button>
              </div>
            </TabsContent>

            {/* Networks Tab */}
            <TabsContent value="networks" className="space-y-4 mt-0">
              {saveMessage && (
                <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${saveMessage.includes('success') ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                  {saveMessage.includes('success') ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {saveMessage}
                </div>
              )}

              <div className="space-y-3">
                {(Object.keys(settings.adConfigs) as AdNetwork[]).map((network) => (
                  <div key={network} className="border rounded-lg bg-white overflow-hidden">
                    <button
                      onClick={() => toggleNetwork(network)}
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={settings.adConfigs[network].enabled}
                          onCheckedChange={() => toggleNetworkEnabled(network)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="font-semibold capitalize">{network}</span>
                        {settings.adConfigs[network].enabled && (
                          <Badge className="bg-green-100 text-green-700">Active</Badge>
                        )}
                      </div>
                      {expandedNetworks[network] ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>

                    {expandedNetworks[network] && (
                      <div className="p-4 pt-0 border-t bg-slate-50 space-y-3">
                        <div>
                          <Label className="text-sm">Publisher ID</Label>
                          <Input
                            value={settings.adConfigs[network].publisherId}
                            onChange={(e) => updateNetworkConfig(network, 'publisherId', e.target.value)}
                            placeholder="Enter publisher ID"
                            className="mt-1"
                          />
                        </div>
                        {(network === 'adsense' || network === 'medianet') && (
                          <div>
                            <Label className="text-sm">Slot ID</Label>
                            <Input
                              value={settings.adConfigs[network].slotId || ''}
                              onChange={(e) => updateNetworkConfig(network, 'slotId', e.target.value)}
                              placeholder="Enter slot ID"
                              className="mt-1"
                            />
                          </div>
                        )}
                        {network === 'monetag' && (
                          <div>
                            <Label className="text-sm">Script URL</Label>
                            <Input
                              value={settings.adConfigs[network].scriptUrl || ''}
                              onChange={(e) => updateNetworkConfig(network, 'scriptUrl', e.target.value)}
                              placeholder="Enter script URL"
                              className="mt-1"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button onClick={handleSaveSettings} className="w-full bg-blue-600 hover:bg-blue-700">
                <Save className="mr-2 h-4 w-4" />
                Save Network Settings
              </Button>
            </TabsContent>

            {/* Statistics Tab */}
            <TabsContent value="stats" className="space-y-4 mt-0">
              {stats ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Total Downloads</CardDescription>
                        <CardTitle className="text-3xl">{stats.total_downloads?.toLocaleString() || 0}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Today's Downloads</CardDescription>
                        <CardTitle className="text-3xl">{stats.today_downloads?.toLocaleString() || 0}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Ad Impressions</CardDescription>
                        <CardTitle className="text-3xl">{stats.ad_impressions?.toLocaleString() || 0}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Ad Clicks</CardDescription>
                        <CardTitle className="text-3xl">{stats.ad_clicks?.toLocaleString() || 0}</CardTitle>
                      </CardHeader>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Click-Through Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-600 rounded-full transition-all"
                              style={{ width: `${Math.min((stats.ctr || 0) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                        <span className="font-bold text-lg">{((stats.ctr || 0) * 100).toFixed(2)}%</span>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex gap-2">
                    <Button onClick={loadStats} variant="outline" className="flex-1">
                      Refresh Stats
                    </Button>
                    <Button onClick={handleResetStats} variant="destructive">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  </div>

                  <p className="text-xs text-slate-500 text-center">
                    Last updated: {stats.updated_at ? new Date(stats.updated_at).toLocaleString() : 'Never'}
                  </p>
                </>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p>Loading statistics...</p>
                </div>
              )}
            </TabsContent>

      {/* Content Management Tab */}
      <TabsContent value="content" className="mt-0">
        <ContentManagementTab />
      </TabsContent>

      {/* Verification Code Tab */}
      <TabsContent value="verification" className="mt-0">
        <VerificationCodesTab />
      </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
