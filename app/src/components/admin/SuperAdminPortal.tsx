/**
 * SuperAdmin Portal
 * Comprehensive admin dashboard for:
 * - User management
 * - Free-app access, Robin credits, sponsor/ad controls
 * - Ad configuration
 * - AI API settings
 * - System analytics
 */

import { useCallback, useEffect, useState } from 'react';
import { 
  Users, 
  CreditCard, 
  Settings, 
  BarChart3, 
  Shield, 
  DollarSign,
  Activity,
  Search,
  RefreshCw,
  Tag,
  TrendingUp,
  Plus,
  Trash2,
  Edit,
  Percent,
  Globe,
  Megaphone,
  MessageSquare,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Mail,
  Sparkles,
  Copy,
  ExternalLink,
  Bot,
  Clock,
  Download,
  Eye,
  MousePointerClick
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
// import { Alert, AlertDescription } from '@/components/ui/alert';
import { useOptionalAuth } from '@/lib/auth/AuthContext';
import { cn } from '@/lib/utils';
import { SEOSettingsTab } from './SEOSettingsTab';
import { SEOExpansionTab } from './SEOExpansionTab';
import { PAID_PLANS } from '@/lib/plans';
import {
  fetchAdminAISettings,
  fetchAdminAdSettings,
  fetchAdminLawyerDirectory,
  fetchAdminPdfDownloadOffer,
  fetchAdminPdfDownloadOfferStats,
  fetchAdminRobinUsageSettings,
  fetchAdminSystemStatus,
  fetchAdminWelcomeMessages,
  refreshAdminAIProviderModels,
  saveAdminAdSettings,
  saveAdminAISettings,
  saveAdminLawyerDirectory,
  saveAdminPdfDownloadOffer,
  saveAdminRobinUsageSettings,
  saveAdminWelcomeMessages,
  type AdminAdSettings,
  type AdminAISettings,
  type AdminAIRoleId,
  type AdminLawyerDirectoryEntry,
  type AdminLawyerDirectorySettings,
  type AdminPdfDownloadOfferSettings,
  type AdminPdfDownloadOfferStats,
  type AdminProviderStatus,
  type AdminRobinMessagePack,
  type AdminRobinUsageSettings,
  type AdminSystemStatus,
  type AdminWelcomeMessageSettings,
} from '@/lib/admin/systemStatus';
import {
  fetchAdminUserActivity,
  fetchAdminUsers,
  grantAdminUserRobinCredits,
  sendAdminUserMessage,
  type AdminUserActivityItem,
  type AdminUserActivityResponse,
  type AdminUserSnapshot,
  type AdminUsersResponse,
} from '@/lib/admin/users';
import { downloadAdminCsv } from '@/lib/admin/reports';
import {
  createAdminSponsorLink,
  fetchAdminSponsorLinks,
  updateAdminSponsorLink,
  type AdminSponsorLink,
} from '@/lib/admin/sponsorLinks';
import { fetchAdminMemoryStatus, type AdminMemoryStatus } from '@/lib/admin/memory';
import {
  closeTicket,
  createBroadcast,
  draftSupportTicketReply,
  getBroadcastMessages,
  getOpenTicketsForAdmin,
  publishBroadcast,
  replyToTicket,
  toggleBroadcastStatus,
} from '@/lib/notifications/api';
import type { AdminSupportTicket, BroadcastAudience, BroadcastMessage } from '@/lib/notifications';
import { BROADCAST_AUDIENCE_LABELS } from '@/lib/notifications';
import { RichMessageContent } from '@/components/messages/RichMessageContent';
import {
  getCandidateDetails,
  getCandidateStats,
  getPendingCandidates,
  updateCandidateReview,
  type AdminCandidateView,
  type CandidateStats,
} from '@/lib/answer-candidates/api';

interface SuperAdminPortalProps {
  onClose: () => void;
}

function useAdminSystemStatus() {
  const [status, setStatus] = useState<AdminSystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStatus(await fetchAdminSystemStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load system status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { status, isLoading, error, refresh };
}

function useAdminMemoryStatus() {
  const [status, setStatus] = useState<AdminMemoryStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStatus(await fetchAdminMemoryStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load memory status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { status, isLoading, error, refresh };
}

function formatCents(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function ConfigBadge({ configured, label }: { configured: boolean; label?: string }) {
  return (
    <Badge
      variant="outline"
      className={configured
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-amber-50 text-amber-700 border-amber-200'
      }
    >
      {configured ? (label || 'Configured') : 'Missing'}
    </Badge>
  );
}

function StatusLoadState({
  isLoading,
  error,
  onRefresh,
}: {
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Loading live configuration...
      </div>
    );
  }

  if (!error) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        {error}
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh}>Retry</Button>
    </div>
  );
}

export function SuperAdminPortal({ onClose }: SuperAdminPortalProps) {
  const { isAdmin, isSuperAdmin, user } = useOptionalAuth();
  const [activeTab, setActiveTab] = useState('overview');
  // Notification state - available for future use
  // const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Redirect if not an admin
  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-slate-800 mb-2">Access Denied</h2>
            <p className="text-slate-500 mb-4">You need an admin role to access the admin portal.</p>
            <Button onClick={onClose} className="bg-slate-700 hover:bg-slate-800">
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 overflow-auto">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-slate-700" />
              <h1 className="text-xl font-medium text-slate-800">Admin Portal</h1>
              <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                {isSuperAdmin ? 'SuperAdmin' : 'Admin'}
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">{user?.email}</span>
              <Button variant="outline" size="sm" onClick={onClose}>
                Exit Admin
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Notification alert - available for future use */}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-[repeat(9,minmax(0,1fr))] mb-8">
            <TabsTrigger value="overview" className="gap-2">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="broadcasts" className="gap-2">
              <Megaphone className="w-4 h-4" />
              <span className="hidden sm:inline">Broadcasts</span>
            </TabsTrigger>
            <TabsTrigger value="ads" className="gap-2">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">Ads</span>
            </TabsTrigger>
            <TabsTrigger value="answers" className="gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Answers</span>
            </TabsTrigger>
            <TabsTrigger value="seo" className="gap-2">
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">SEO</span>
            </TabsTrigger>
            <TabsTrigger value="seo-expansion" className="gap-2">
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">SEO Expansion</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">AI APIs</span>
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">System</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="users">
            <UsersTab />
          </TabsContent>

          <TabsContent value="broadcasts">
            <BroadcastsTab />
          </TabsContent>

          <TabsContent value="answers">
            <AnswerExamplesTab />
          </TabsContent>

          <TabsContent value="seo">
            <SEOSettingsTab />
          </TabsContent>

          <TabsContent value="seo-expansion">
            <SEOExpansionTab />
          </TabsContent>

          <TabsContent value="ads">
            <AdsTab />
          </TabsContent>

          <TabsContent value="ai">
            <AIConfigTab />
          </TabsContent>

          <TabsContent value="system">
            <SystemTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// Overview Tab
function OverviewTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value="0"
          change=""
          trend="up"
          icon={Users}
        />
        <StatCard
          title="Free Access"
          value="0"
          change=""
          trend="up"
          icon={Sparkles}
        />
        <StatCard
          title="Sponsor Clicks"
          value="0"
          change=""
          trend="up"
          icon={MousePointerClick}
        />
        <StatCard
          title="PDF Downloads"
          value="0"
          change=""
          trend="up"
          icon={Activity}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
              No admin activity yet.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <HealthItem name="Database" status="healthy" />
              <HealthItem name="Authentication" status="healthy" />
              <HealthItem name="AI API" status="healthy" />
              <HealthItem name="Storage" status="healthy" />
              <HealthItem name="Email Service" status="healthy" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Users Tab
function UsersTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [usersResponse, setUsersResponse] = useState<AdminUsersResponse | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserSnapshot | null>(null);
  const [selectedUserActivity, setSelectedUserActivity] = useState<AdminUserActivityResponse | null>(null);
  const [isLoadingUserActivity, setIsLoadingUserActivity] = useState(false);
  const [userActivityError, setUserActivityError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState({ title: '', message: '', sendEmail: true });
  const [userMessageStatus, setUserMessageStatus] = useState<string | null>(null);
  const [isSendingUserMessage, setIsSendingUserMessage] = useState(false);
  const [robinCreditGrant, setRobinCreditGrant] = useState({
    label: 'Admin Robin credit grant',
    messages: 25,
    expirationDays: 365,
    note: '',
  });
  const [robinCreditStatus, setRobinCreditStatus] = useState<string | null>(null);
  const [isGrantingRobinCredits, setIsGrantingRobinCredits] = useState(false);
  const [isExportingUsers, setIsExportingUsers] = useState(false);
  const [isExportingTimeline, setIsExportingTimeline] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setUsersResponse(await fetchAdminUsers(150));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (!selectedUser) {
      setSelectedUserActivity(null);
      setUserActivityError(null);
      return;
    }

    let isMounted = true;
    setUserMessage({
      title: 'Message from Spouse Interview',
      message: '',
      sendEmail: true,
    });
    setRobinCreditGrant({
      label: 'Admin Robin credit grant',
      messages: 25,
      expirationDays: 365,
      note: '',
    });
    setUserMessageStatus(null);
    setRobinCreditStatus(null);
    setSelectedUserActivity(null);
    setUserActivityError(null);
    setIsLoadingUserActivity(true);

    fetchAdminUserActivity(selectedUser.id)
      .then((activity) => {
        if (isMounted) setSelectedUserActivity(activity);
      })
      .catch((err) => {
        if (isMounted) setUserActivityError(err instanceof Error ? err.message : 'Unable to load user activity');
      })
      .finally(() => {
        if (isMounted) setIsLoadingUserActivity(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedUser]);

  const formatDate = (value?: string | null) => {
    if (!value) return 'Not set';
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(value));
    } catch {
      return value;
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'Not set';
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(value));
    } catch {
      return value;
    }
  };

  const formatRelativeTime = (value?: string | null) => {
    if (!value) return 'No activity yet';
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return formatDateTime(value);
    const diffMs = Date.now() - timestamp;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diffMs < minute) return 'Just now';
    if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
    if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
    if (diffMs < 30 * day) return `${Math.floor(diffMs / day)}d ago`;
    return formatDate(value);
  };

  const activityIcon = (kind: string) => {
    if (kind === 'robin') return Bot;
    if (kind === 'robin_credit') return CreditCard;
    if (kind === 'pdf') return Download;
    if (kind === 'message_opened') return Eye;
    if (kind === 'message_clicked') return MousePointerClick;
    if (kind.startsWith('message')) return Mail;
    if (kind === 'support') return MessageSquare;
    if (kind === 'practice' || kind === 'topic_progress') return CheckCircle;
    return Activity;
  };

  const activityClass = (kind: string) => {
    if (kind === 'robin') return 'bg-violet-50 text-violet-700 ring-violet-100';
    if (kind === 'robin_credit') return 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100';
    if (kind === 'pdf') return 'bg-blue-50 text-blue-700 ring-blue-100';
    if (kind.startsWith('message')) return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    if (kind === 'support') return 'bg-amber-50 text-amber-700 ring-amber-100';
    if (kind === 'practice' || kind === 'topic_progress') return 'bg-cyan-50 text-cyan-700 ring-cyan-100';
    return 'bg-slate-50 text-slate-700 ring-slate-100';
  };

  const renderActivityItem = (item: AdminUserActivityItem) => {
    const Icon = activityIcon(item.kind);
    return (
      <div key={`${item.kind}-${item.occurred_at}-${item.detail}`} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1', activityClass(item.kind))}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-extrabold text-slate-950">{item.title}</p>
            <span className="text-xs font-semibold text-slate-500">{formatRelativeTime(item.occurred_at)}</span>
          </div>
          <p className="mt-1 break-words text-sm font-medium text-slate-700">{item.detail}</p>
          <p className="mt-1 text-xs font-medium text-slate-400">{formatDateTime(item.occurred_at)}</p>
        </div>
      </div>
    );
  };

  const filteredUsers = (usersResponse?.users ?? []).filter(user => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [user.email, user.display_name, user.id, user.plan_type, user.subscription_status]
      .some(value => String(value || '').toLowerCase().includes(query));
  });

  const handleSendUserMessage = async () => {
    if (!selectedUser || !userMessage.title.trim() || !userMessage.message.trim()) return;
    setIsSendingUserMessage(true);
    setUserMessageStatus(null);
    try {
      await sendAdminUserMessage(selectedUser.id, userMessage);
      setUserMessageStatus('Message sent to dashboard inbox.');
      setUserMessage(prev => ({ ...prev, message: '' }));
      void loadUsers();
    } catch (err) {
      setUserMessageStatus(err instanceof Error ? err.message : 'Unable to send message');
    } finally {
      setIsSendingUserMessage(false);
    }
  };

  const handleGrantRobinCredits = async () => {
    if (!selectedUser || robinCreditGrant.messages <= 0) return;
    setIsGrantingRobinCredits(true);
    setRobinCreditStatus(null);
    try {
      const credits = await grantAdminUserRobinCredits(selectedUser.id, robinCreditGrant);
      setSelectedUserActivity(prev => prev ? { ...prev, robinCredits: credits } : prev);
      const refreshed = await fetchAdminUserActivity(selectedUser.id);
      setSelectedUserActivity(refreshed);
      setRobinCreditStatus('Robin credits granted and ledger updated.');
      setRobinCreditGrant(prev => ({ ...prev, note: '' }));
      void loadUsers();
    } catch (err) {
      setRobinCreditStatus(err instanceof Error ? err.message : 'Unable to grant Robin credits');
    } finally {
      setIsGrantingRobinCredits(false);
    }
  };

  const handleDownloadUserActivityReport = async () => {
    setIsExportingUsers(true);
    setError(null);
    try {
      await downloadAdminCsv('/api/admin/reports/user-activity.csv', 'spouse-interview-user-activity.csv');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download user activity report');
    } finally {
      setIsExportingUsers(false);
    }
  };

  const handleDownloadSelectedTimeline = async () => {
    if (!selectedUser) return;
    setIsExportingTimeline(true);
    setUserActivityError(null);
    try {
      await downloadAdminCsv(
        `/api/admin/users/${selectedUser.id}/activity.csv`,
        'spouse-interview-user-timeline.csv'
      );
    } catch (err) {
      setUserActivityError(err instanceof Error ? err.message : 'Unable to download user timeline');
    } finally {
      setIsExportingTimeline(false);
    }
  };

  const selectedActivityItems = selectedUserActivity?.activity ?? [];
  const selectedDailyAiUsage = selectedUserActivity?.dailyAiUsage ?? [];
  const selectedRecentDownloads = selectedUserActivity?.recentDownloads ?? [];
  const selectedMessageStats = selectedUserActivity?.messageStats;
  const selectedRobinCredits = selectedUserActivity?.robinCredits;
  const selectedRobinCreditLedger = selectedRobinCredits?.ledger ?? [];
  const selectedRobinCreditGrants = selectedRobinCredits?.grants ?? [];
  const selectedTwoWeekRobinTurns = selectedDailyAiUsage.reduce((total, day) => total + Number(day.total_turns || 0), 0);
  const selectedTwoWeekRobinSessions = selectedDailyAiUsage.reduce((total, day) => total + Number(day.sessions_count || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard title="Total Users" value={(usersResponse?.totals.totalUsers ?? 0).toLocaleString()} change="" trend="up" icon={Users} />
        <StatCard title="Historical Paid" value={(usersResponse?.totals.paidUsers ?? 0).toLocaleString()} change="" trend="up" icon={CreditCard} />
        <StatCard title="Historical Trial" value={(usersResponse?.totals.trialUsers ?? 0).toLocaleString()} change="" trend="up" icon={Activity} />
        <StatCard title="Robin Today" value={(usersResponse?.totals.robinActiveToday ?? 0).toLocaleString()} change="" trend="up" icon={Bot} />
        <StatCard title="Unread Messages" value={(usersResponse?.totals.usersWithUnreadMessages ?? 0).toLocaleString()} change="" trend="up" icon={Mail} />
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
          <Button variant="outline" size="sm" onClick={loadUsers}>Retry</Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base">User Management</CardTitle>
              <CardDescription>Live account, free-app access, PDF download, message, Robin, and spouse-sync snapshots.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadUserActivityReport} disabled={isExportingUsers}>
                {isExportingUsers ? <RefreshCw className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={loadUsers}>
                <RefreshCw className={cn('w-4 h-4 mr-1', isLoading && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No users match this search.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left p-3 font-medium text-slate-600">User</th>
                      <th className="text-left p-3 font-medium text-slate-600">Access</th>
                      <th className="text-left p-3 font-medium text-slate-600">Dashboard Snapshot</th>
                      <th className="text-left p-3 font-medium text-slate-600">Recent Activity</th>
                      <th className="text-left p-3 font-medium text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b last:border-0">
                        <td className="p-3">
                          <div>
                            <div className="font-medium text-slate-900">{user.display_name}</div>
                            <div className="text-xs text-slate-600">{user.email}</div>
                            <div className="text-xs text-slate-400">ID: {user.id.slice(0, 8)}</div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                              Free app
                            </Badge>
                            <div className="text-xs text-slate-500 capitalize">Historical plan: {user.plan_type} / {user.subscription_status.replace('_', ' ')}</div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{user.unique_pdfs_downloaded} PDFs</Badge>
                            <Badge variant="outline">{user.ai_turns_today} Robin today</Badge>
                            <Badge variant="outline">{user.messages_opened}/{user.messages_received} messages opened</Badge>
                            <Badge variant="outline">{user.topics_completed}/{user.topics_started} topics</Badge>
                            <Badge variant="outline">{user.connected_partners} partner</Badge>
                            <Badge variant="outline">{user.unread_messages} unread</Badge>
                          </div>
                        </td>
                        <td className="p-3 text-slate-600">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 font-semibold text-slate-800">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              {formatRelativeTime(user.last_activity_at || user.updated_at)}
                            </div>
                            <div className="text-xs text-slate-500">Joined {formatDate(user.joined_at)}</div>
                          </div>
                        </td>
                        <td className="p-3">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedUser(user)}>Assist</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-h-[92vh] w-full max-w-6xl overflow-hidden">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>User Activity Dashboard</CardTitle>
                  <CardDescription>{selectedUser.display_name} - {selectedUser.email}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadSelectedTimeline} disabled={isExportingTimeline}>
                    {isExportingTimeline ? <RefreshCw className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                    Export Timeline
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedUser(null)}>Close</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="max-h-[calc(92vh-96px)] space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Access</div>
                  <div className="mt-1 font-semibold text-slate-900">Free app</div>
                  <div className="text-xs text-slate-500 capitalize">Historical plan: {selectedUser.plan_type} / {selectedUser.subscription_status.replace('_', ' ')}</div>
                </div>
                <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-violet-700">Robin Today</div>
                  <div className="mt-1 font-semibold text-slate-900">{selectedUser.ai_turns_today} turns</div>
                  <div className="text-xs text-violet-700">{selectedUser.ai_sessions_today} sessions</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">PDF Usage</div>
                  <div className="mt-1 font-semibold text-slate-900">{selectedUser.total_downloads} downloads</div>
                  <div className="text-xs text-slate-500">{selectedUser.unique_pdfs_downloaded} unique files</div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Messages</div>
                  <div className="mt-1 font-semibold text-slate-900">{selectedUser.messages_opened}/{selectedUser.messages_received} opened</div>
                  <div className="text-xs text-emerald-700">{selectedUser.messages_clicked} clicked - {selectedUser.unread_messages} unread</div>
                </div>
                <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Practice</div>
                  <div className="mt-1 font-semibold text-slate-900">{selectedUser.topics_completed}/{selectedUser.topics_started} topics</div>
                  <div className="text-xs text-cyan-700">{selectedUser.saved_questions} saved questions</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Partner Sync</div>
                  <div className="mt-1 font-semibold text-slate-900">{selectedUser.connected_partners} connected</div>
                  <div className="text-xs text-slate-500">{selectedUser.pending_partners} pending</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm lg:grid-cols-3">
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-slate-900">Dashboard Messages</div>
                  </div>
                  <p className="mt-1 text-slate-600">
                    {selectedUser.messages_received} received, {selectedUser.unread_messages} unread,
                    {selectedUser.messages_opened} opened, and {selectedUser.messages_clicked} clicked.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="font-medium text-slate-900">Free-App Access</div>
                  <p className="mt-1 text-slate-600">
                    Core access is not tied to an active paid plan. Historical provider ID:
                    {' '}{selectedUser.provider_customer_id || 'not attached'}.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="font-medium text-slate-900">Last Seen Activity</div>
                  <p className="mt-1 text-slate-600">
                    {formatRelativeTime(selectedUser.last_activity_at || selectedUser.updated_at)}.
                    Last Robin: {formatDateTime(selectedUser.last_ai_at)}.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-extrabold text-slate-950">Recent Activity</div>
                      <p className="text-sm font-semibold text-slate-600">{selectedActivityItems.length} recent events</p>
                    </div>
                    {isLoadingUserActivity && <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />}
                  </div>
                  {userActivityError ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                      {userActivityError}
                    </div>
                  ) : isLoadingUserActivity ? (
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading activity...
                    </div>
                  ) : selectedActivityItems.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600">
                      No activity recorded yet.
                    </div>
                  ) : (
                    <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
                      {selectedActivityItems.map(renderActivityItem)}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-extrabold text-slate-950">Robin Usage</div>
                      <Bot className="h-4 w-4 text-violet-700" />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs font-bold uppercase text-violet-700">14-day turns</p>
                        <p className="mt-1 text-lg font-extrabold text-slate-950">{selectedTwoWeekRobinTurns.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs font-bold uppercase text-violet-700">14-day sessions</p>
                        <p className="mt-1 text-lg font-extrabold text-slate-950">{selectedTwoWeekRobinSessions.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {selectedDailyAiUsage.slice(0, 5).map((day) => (
                        <div key={day.usage_date} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                          <span className="font-semibold text-slate-700">{formatDate(day.usage_date)}</span>
                          <span className="font-extrabold text-slate-950">{day.total_turns} turns · {day.sessions_count} sessions</span>
                        </div>
                      ))}
                      {!isLoadingUserActivity && selectedDailyAiUsage.length === 0 && (
                        <p className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600">No Robin usage recorded.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-extrabold text-slate-950">Robin Credit Ledger</div>
                        <p className="text-xs font-semibold text-fuchsia-800">Manual paid-credit scaffold. Checkout can attach here later.</p>
                      </div>
                      <CreditCard className="h-4 w-4 text-fuchsia-700" />
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
                      <div className="rounded-lg bg-white p-2">
                        <p className="font-extrabold text-slate-950">{Number(selectedRobinCredits?.balance ?? 0).toLocaleString()}</p>
                        <p className="text-xs font-bold text-slate-500">Balance</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="font-extrabold text-slate-950">{Number(selectedRobinCredits?.activeGrantCount ?? 0).toLocaleString()}</p>
                        <p className="text-xs font-bold text-slate-500">Grants</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="font-extrabold text-slate-950">{Number(selectedRobinCredits?.totalUsed ?? 0).toLocaleString()}</p>
                        <p className="text-xs font-bold text-slate-500">Used</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="font-extrabold text-slate-950">{Number(selectedRobinCredits?.expiredMessages ?? 0).toLocaleString()}</p>
                        <p className="text-xs font-bold text-slate-500">Expired</p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs font-bold text-slate-700">Messages</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100000}
                          value={robinCreditGrant.messages}
                          onChange={(event) => setRobinCreditGrant(prev => ({ ...prev, messages: Number(event.target.value) || 1 }))}
                          className="mt-1 bg-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-700">Expires in days</Label>
                        <Input
                          type="number"
                          min={1}
                          max={3650}
                          value={robinCreditGrant.expirationDays}
                          onChange={(event) => setRobinCreditGrant(prev => ({ ...prev, expirationDays: Number(event.target.value) || 365 }))}
                          className="mt-1 bg-white"
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <Label className="text-xs font-bold text-slate-700">Grant label</Label>
                      <Input
                        value={robinCreditGrant.label}
                        onChange={(event) => setRobinCreditGrant(prev => ({ ...prev, label: event.target.value }))}
                        className="mt-1 bg-white"
                      />
                    </div>
                    <div className="mt-2">
                      <Label className="text-xs font-bold text-slate-700">Internal note</Label>
                      <Input
                        value={robinCreditGrant.note}
                        onChange={(event) => setRobinCreditGrant(prev => ({ ...prev, note: event.target.value }))}
                        placeholder="Optional reason for this grant"
                        className="mt-1 bg-white"
                      />
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-semibold text-fuchsia-800">
                        Paid credits are consumed only after daily free Robin messages are used.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleGrantRobinCredits}
                        disabled={isGrantingRobinCredits || robinCreditGrant.messages <= 0}
                        className="bg-fuchsia-700 font-extrabold text-white hover:bg-fuchsia-800"
                      >
                        {isGrantingRobinCredits ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Grant Credits
                      </Button>
                    </div>
                    {robinCreditStatus && (
                      <p className={cn(
                        'mt-2 text-sm font-bold',
                        robinCreditStatus.includes('Unable') ? 'text-amber-800' : 'text-emerald-700'
                      )}>
                        {robinCreditStatus}
                      </p>
                    )}
                    <div className="mt-3 space-y-2">
                      {selectedRobinCreditLedger.slice(0, 4).map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="font-extrabold capitalize text-slate-950">{entry.event_type.replace('_', ' ')}</p>
                            <p className="text-xs font-semibold text-slate-500">{formatDateTime(entry.created_at)}</p>
                          </div>
                          <div className="text-right">
                            <p className={cn('font-extrabold', entry.messages_delta >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                              {entry.messages_delta >= 0 ? '+' : ''}{entry.messages_delta}
                            </p>
                            <p className="text-xs font-semibold text-slate-500">{entry.balance_after} left</p>
                          </div>
                        </div>
                      ))}
                      {!isLoadingUserActivity && selectedRobinCreditLedger.length === 0 && (
                        <p className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600">No Robin credit ledger entries yet.</p>
                      )}
                    </div>
                    {selectedRobinCreditGrants.length > 0 && (
                      <p className="mt-2 text-xs font-semibold text-slate-600">
                        Next expiration: {formatDate(selectedRobinCreditGrants.find((grant) => !grant.is_expired && grant.messages_remaining > 0)?.expires_at)}
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-extrabold text-slate-950">Message Engagement</div>
                      <Mail className="h-4 w-4 text-emerald-700" />
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
                      <div className="rounded-lg bg-white p-2">
                        <p className="font-extrabold text-slate-950">{Number(selectedMessageStats?.received ?? selectedUser.messages_received).toLocaleString()}</p>
                        <p className="text-xs font-bold text-slate-500">Received</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="font-extrabold text-slate-950">{Number(selectedMessageStats?.opened ?? selectedUser.messages_opened).toLocaleString()}</p>
                        <p className="text-xs font-bold text-slate-500">Opened</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="font-extrabold text-slate-950">{Number(selectedMessageStats?.clicked ?? selectedUser.messages_clicked).toLocaleString()}</p>
                        <p className="text-xs font-bold text-slate-500">Clicked</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="font-extrabold text-slate-950">{Number(selectedMessageStats?.unread ?? selectedUser.unread_messages).toLocaleString()}</p>
                        <p className="text-xs font-bold text-slate-500">Unread</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-extrabold text-slate-950">Recent PDFs</div>
                      <FileText className="h-4 w-4 text-blue-700" />
                    </div>
                    <div className="mt-3 space-y-2">
                      {selectedRecentDownloads.slice(0, 5).map((download) => (
                        <div key={download.id} className="rounded-lg bg-white px-3 py-2 text-sm">
                          <p className="line-clamp-1 font-extrabold text-slate-950">{download.title}</p>
                          <p className="text-xs font-semibold text-slate-500">{formatDateTime(download.created_at)} · {download.event_status || 'recorded'}</p>
                        </div>
                      ))}
                      {!isLoadingUserActivity && selectedRecentDownloads.length === 0 && (
                        <p className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600">No PDF downloads recorded.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-4">
                <div className="mb-3">
                  <div className="font-extrabold text-slate-950">Send this user a dashboard message</div>
                  <p className="text-sm font-semibold text-slate-600">Supports plain text or safe HTML and can also email the user.</p>
                </div>
                <div className="space-y-3">
                  <Input
                    value={userMessage.title}
                    onChange={(event) => setUserMessage(prev => ({ ...prev, title: event.target.value }))}
                    placeholder="Message title"
                    className="bg-white font-semibold text-slate-950"
                  />
                  <textarea
                    value={userMessage.message}
                    onChange={(event) => setUserMessage(prev => ({ ...prev, message: event.target.value }))}
                    placeholder="Write the message or paste simple HTML with links..."
                    className="min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Switch
                        checked={userMessage.sendEmail}
                        onCheckedChange={(checked) => setUserMessage(prev => ({ ...prev, sendEmail: checked }))}
                      />
                      Email user too
                    </label>
                    <Button onClick={handleSendUserMessage} disabled={isSendingUserMessage || !userMessage.message.trim()} className="bg-gradient-to-r from-blue-700 to-cyan-700 text-white">
                      {isSendingUserMessage ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                      Send Message
                    </Button>
                  </div>
                  {userMessageStatus && <p className="text-sm font-bold text-emerald-700">{userMessageStatus}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Billing Tab
function BillingTab() {
  const { status, isLoading, error, refresh } = useAdminSystemStatus();

  return (
    <div className="space-y-6">
      <StatusLoadState isLoading={isLoading} error={error} onRefresh={refresh} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Subscription Plans</CardTitle>
              <CardDescription>Live app pricing and Stripe test price wiring.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {PAID_PLANS.map((plan) => {
              const price = status?.stripe.prices[plan.id as keyof AdminSystemStatus['stripe']['prices']];
              const amount = price ? formatCents(price.expectedAmount, price.currency) : ('price' in plan ? `$${plan.price}` : 'Paid');

              return (
              <div key={plan.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium text-slate-800">{plan.name}</div>
                  <div className="text-sm text-slate-600">{amount} {price?.mode === 'subscription' ? 'recurring monthly' : 'one-time'}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    PDFs, partner sync, Robin practice, provider/model choice
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <ConfigBadge configured={Boolean(price?.configured)} />
                  <span className="hidden sm:inline text-xs text-slate-500">{price?.envVar}</span>
                </div>
              </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stripe Test Mode Status</CardTitle>
          <CardDescription>Secrets are stored in Coolify environment variables and are never displayed here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mode</div>
              <div className="mt-2">
                <Badge className={status?.stripe.mode === 'test' ? 'bg-blue-600' : 'bg-slate-600'}>
                  {status?.stripe.mode || 'unknown'}
                </Badge>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Secret key</div>
              <div className="mt-2"><ConfigBadge configured={Boolean(status?.stripe.secretKeyConfigured)} /></div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Publishable key</div>
              <div className="mt-2"><ConfigBadge configured={Boolean(status?.stripe.publishableKeyConfigured)} /></div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Webhook</div>
              <div className="mt-2"><ConfigBadge configured={Boolean(status?.stripe.webhookConfigured)} /></div>
            </div>
          </div>

          {status?.stripe.autoCreateTestPrices && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              Test-mode price auto-creation is enabled. If explicit price IDs are missing, checkout will create or reuse
              Stripe test prices with fixed lookup keys for the three paid plans.
            </div>
          )}

          <div className={cn(
            'rounded-lg border p-4 text-sm',
            status?.stripe.checkoutReady
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          )}>
            <div className="font-medium">
              {status?.stripe.checkoutReady ? 'Checkout is ready.' : 'Checkout needs Stripe test configuration.'}
            </div>
            <p className="mt-1">
              Required env vars: STRIPE_SECRET_KEY plus STRIPE_PRICE_ID_MONTHLY, STRIPE_PRICE_ID_LIFETIME, and STRIPE_PRICE_ID_INTERVIEW_PASS.
              Webhooks also need STRIPE_WEBHOOK_SECRET to automatically move users from trial to paid after payment.
            </p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

// Promo Codes Tab
interface PromoCode {
  code: string;
  influencer_name: string;
  discount_percent: number;
  is_active: boolean;
  total_referrals: number;
  total_signups: number;
  total_purchases: number;
  total_paid_users: number;
}

function PromoCodesTab() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newInfluencer, setNewInfluencer] = useState('');
  const [newDiscount, setNewDiscount] = useState(10);

  const handleToggleActive = (code: string) => {
    setPromoCodes(codes => codes.map(c => 
      c.code === code ? { ...c, is_active: !c.is_active } : c
    ));
  };

  const handleAddCode = () => {
    if (newCode && newInfluencer) {
      setPromoCodes(codes => [...codes, {
        code: newCode.toUpperCase(),
        influencer_name: newInfluencer,
        discount_percent: newDiscount,
        is_active: true,
        total_referrals: 0,
        total_signups: 0,
        total_purchases: 0,
        total_paid_users: 0,
      }]);
      setNewCode('');
      setNewInfluencer('');
      setNewDiscount(10);
      setShowAddForm(false);
    }
  };

  const totalReferrals = promoCodes.reduce((sum, c) => sum + c.total_referrals, 0);
  const totalSignups = promoCodes.reduce((sum, c) => sum + c.total_signups, 0);
  const totalPurchases = promoCodes.reduce((sum, c) => sum + c.total_purchases, 0);
  const totalPaidUsers = promoCodes.reduce((sum, c) => sum + c.total_paid_users, 0);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Referrals"
          value={totalReferrals.toLocaleString()}
          change=""
          trend="up"
          icon={TrendingUp}
        />
        <StatCard
          title="Total Signups"
          value={totalSignups.toLocaleString()}
          change=""
          trend="up"
          icon={Users}
        />
        <StatCard
          title="Total Purchases"
          value={totalPurchases.toLocaleString()}
          change=""
          trend="up"
          icon={DollarSign}
        />
        <StatCard
          title="Paid Users"
          value={totalPaidUsers.toLocaleString()}
          change=""
          trend="up"
          icon={Activity}
        />
      </div>

      {/* Promo Codes List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Promo Codes</CardTitle>
              <CardDescription>Manage influencer promo codes and track performance</CardDescription>
            </div>
            <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-slate-700 hover:bg-slate-800">
              <Plus className="w-4 h-4 mr-2" />
              Add Code
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Add New Code Form */}
          {showAddForm && (
            <div className="mb-6 p-4 border rounded-lg bg-slate-50 space-y-4">
              <h4 className="font-medium text-slate-700">Add New Promo Code</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input
                    placeholder="e.g., MARIA10"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Influencer Name</Label>
                  <Input
                    placeholder="e.g., Maria Garcia"
                    value={newInfluencer}
                    onChange={(e) => setNewInfluencer(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discount %</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={newDiscount}
                    onChange={(e) => setNewDiscount(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddCode} className="bg-slate-700 hover:bg-slate-800">
                  Create Code
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Codes Table */}
          <div className="border rounded-lg">
            {promoCodes.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Tag className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">No promo codes yet</p>
                <p className="text-sm">Click "Add Code" to create your first promo code.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-3 font-medium text-slate-600">Code</th>
                    <th className="text-left p-3 font-medium text-slate-600">Influencer</th>
                    <th className="text-left p-3 font-medium text-slate-600">Discount</th>
                    <th className="text-left p-3 font-medium text-slate-600">Referrals</th>
                    <th className="text-left p-3 font-medium text-slate-600">Signups</th>
                    <th className="text-left p-3 font-medium text-slate-600">Purchases</th>
                    <th className="text-left p-3 font-medium text-slate-600">Paid Users</th>
                    <th className="text-left p-3 font-medium text-slate-600">Status</th>
                    <th className="text-left p-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promoCodes.map((code) => (
                    <tr key={code.code} className="border-b last:border-0">
                      <td className="p-3">
                        <div className="font-medium text-slate-800">{code.code}</div>
                      </td>
                      <td className="p-3 text-slate-600">{code.influencer_name}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                          <Percent className="w-3 h-3 mr-1" />
                          {code.discount_percent}%
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-600">{code.total_referrals.toLocaleString()}</td>
                      <td className="p-3 text-slate-600">{code.total_signups.toLocaleString()}</td>
                      <td className="p-3 text-slate-600">{code.total_purchases.toLocaleString()}</td>
                      <td className="p-3 text-slate-600">{code.total_paid_users.toLocaleString()}</td>
                      <td className="p-3">
                        <Switch
                          checked={code.is_active}
                          onCheckedChange={() => handleToggleActive(code.code)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Referral URL Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referral URL Examples</CardTitle>
          <CardDescription>Share these URLs with influencers. Both formats work identically.</CardDescription>
        </CardHeader>
        <CardContent>
          {promoCodes.filter(c => c.is_active).length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No active promo codes.</p>
              <p className="text-sm">Create a promo code to generate referral URLs.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {promoCodes.filter(c => c.is_active).slice(0, 3).map((code) => (
                <div key={code.code} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-slate-800">{code.influencer_name}</div>
                    <Badge variant="outline">{code.discount_percent}% off</Badge>
                  </div>
                  <div className="space-y-1">
                    <code className="text-sm text-slate-500 block">{`https://www.SpouseInterview.com/?ref=${code.code}`}</code>
                    <code className="text-sm text-slate-500 block">{`https://www.SpouseInterview.com/ref/${code.code}`}</code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Ads Tab
const DEFAULT_AD_SETTINGS: AdminAdSettings = {
  status: 'disabled',
  adsensePublisherId: '',
  adsenseSlotId: '',
  includeAdsenseMeta: true,
  includeAdsenseScript: false,
  enableAdsTxt: false,
  adsTxt: '',
  placements: {
    'dashboard.inline': false,
    'pdf_library.inline': false,
    'practice_completion.pre_download': false,
    'robin.inline': false,
    'messages.inline': false,
  },
};

const AD_PLACEMENT_LABELS: Record<string, string> = {
  'dashboard.inline': 'Dashboard inline slot',
  'pdf_library.inline': 'PDF Library inline slot',
  'practice_completion.pre_download': 'Practice completion before PDF download',
  'robin.inline': 'Robin page inline slot',
  'messages.inline': 'Messages inbox inline slot',
};

const DEFAULT_PDF_DOWNLOAD_OFFER: AdminPdfDownloadOfferSettings = {
  enabled: false,
  disclosureLabel: 'Sponsored Resource',
  title: 'Before you download',
  bodyHtml: '',
  ctaLabel: 'Open sponsored resource',
  ctaUrl: '',
  continueLabel: 'Continue to PDF',
  frequency: 'once_per_session',
  sources: {
    topic_page: false,
    practice_mode: false,
    practice_completion: true,
    direct_link: false,
    seo_page: false,
    pdf_library: false,
  },
};

const PDF_OFFER_SOURCE_LABELS: Record<string, string> = {
  practice_completion: 'After completing a topic',
  topic_page: 'Topic detail download tab',
  practice_mode: 'Practice header PDF button',
  pdf_library: 'PDF library downloads',
  seo_page: 'SEO/public guide pages',
  direct_link: 'Direct PDF links',
};

function defaultAdsTxtForPublisherId(value: string) {
  const cleaned = value.trim().replace(/^ca-/, '');
  return cleaned ? `google.com, ${cleaned}, DIRECT, f08c47fec0942fa0` : '';
}

function AdsTab() {
  const [settings, setSettings] = useState<AdminAdSettings | null>(null);
  const [pdfOffer, setPdfOffer] = useState<AdminPdfDownloadOfferSettings | null>(null);
  const [pdfOfferStats, setPdfOfferStats] = useState<AdminPdfDownloadOfferStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingOffer, setIsSavingOffer] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const adsTxtUrl = typeof window !== 'undefined' ? `${window.location.origin}/ads.txt` : '/ads.txt';

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetchAdminAdSettings(),
      fetchAdminPdfDownloadOffer(),
      fetchAdminPdfDownloadOfferStats(),
    ])
      .then(([adResult, offerResult, offerStats]) => {
        if (isMounted) {
          setSettings({ ...DEFAULT_AD_SETTINGS, ...adResult });
          setPdfOffer({
            ...DEFAULT_PDF_DOWNLOAD_OFFER,
            ...offerResult,
            sources: {
              ...DEFAULT_PDF_DOWNLOAD_OFFER.sources,
              ...(offerResult.sources || {}),
            },
          });
          setPdfOfferStats(offerStats);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setNotice(err instanceof Error ? err.message : 'Unable to load ad settings');
          setSettings(DEFAULT_AD_SETTINGS);
          setPdfOffer(DEFAULT_PDF_DOWNLOAD_OFFER);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const updateSetting = <Key extends keyof AdminAdSettings>(key: Key, value: AdminAdSettings[Key]) => {
    setSettings((current) => current ? { ...current, [key]: value } : current);
  };

  const updatePublisherId = (value: string) => {
    setSettings((current) => {
      if (!current) return current;
      const shouldRefreshAdsTxt = !current.adsTxt.trim() || current.adsTxt.includes('pub-0000000000000000');
      return {
        ...current,
        adsensePublisherId: value,
        adsTxt: shouldRefreshAdsTxt ? defaultAdsTxtForPublisherId(value) : current.adsTxt,
      };
    });
  };

  const updatePlacement = (placement: string, enabled: boolean) => {
    setSettings((current) => current ? {
      ...current,
      placements: {
        ...current.placements,
        [placement]: enabled,
      },
    } : current);
  };

  const updatePdfOffer = <Key extends keyof AdminPdfDownloadOfferSettings>(
    key: Key,
    value: AdminPdfDownloadOfferSettings[Key]
  ) => {
    setPdfOffer((current) => current ? { ...current, [key]: value } : current);
  };

  const updatePdfOfferSource = (source: string, enabled: boolean) => {
    setPdfOffer((current) => current ? {
      ...current,
      sources: {
        ...current.sources,
        [source]: enabled,
      },
    } : current);
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    setNotice(null);
    try {
      const saved = await saveAdminAdSettings(settings);
      setSettings({ ...DEFAULT_AD_SETTINGS, ...saved });
      setNotice('Ad settings saved. Verification code and ads.txt will update on the served app.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to save ad settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePdfOffer = async () => {
    if (!pdfOffer) return;
    setIsSavingOffer(true);
    setNotice(null);
    try {
      const saved = await saveAdminPdfDownloadOffer(pdfOffer);
      setPdfOffer({
        ...DEFAULT_PDF_DOWNLOAD_OFFER,
        ...saved,
        sources: {
          ...DEFAULT_PDF_DOWNLOAD_OFFER.sources,
          ...(saved.sources || {}),
        },
      });
      setNotice('PDF pre-download offer saved. It will remain hidden until enabled for at least one source.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to save PDF offer');
    } finally {
      setIsSavingOffer(false);
    }
  };

  if (isLoading || !settings || !pdfOffer) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm font-semibold text-slate-600">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading ad settings...
        </CardContent>
      </Card>
    );
  }

  const pdfOfferTotals = pdfOfferStats.reduce(
    (totals, row) => ({
      impressions: totals.impressions + Number(row.impressions || 0),
      ctaClicks: totals.ctaClicks + Number(row.cta_clicks || 0),
      bodyLinkClicks: totals.bodyLinkClicks + Number(row.body_link_clicks || 0),
      dismissals: totals.dismissals + Number(row.dismissals || 0),
      continues: totals.continues + Number(row.continues || 0),
    }),
    { impressions: 0, ctaClicks: 0, bodyLinkClicks: 0, dismissals: 0, continues: 0 }
  );
  const pdfOfferClickTotal = pdfOfferTotals.ctaClicks + pdfOfferTotals.bodyLinkClicks;

  return (
    <div className="space-y-6">
      <Card className="border-2 border-cyan-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Ad Network Verification</CardTitle>
          <CardDescription>Prepare AdSense verification and keep all ad placements hidden until ads are approved.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {notice && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
              {notice}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-2">
              <Label className="font-bold text-slate-900">Ad status</Label>
              <select
                value={settings.status}
                onChange={(event) => updateSetting('status', event.target.value as AdminAdSettings['status'])}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950"
              >
                <option value="disabled">Disabled - no ad code or placements</option>
                <option value="verification_only">Verification only - head/ads.txt only</option>
                <option value="active">Active ads - enabled placements may render</option>
              </select>
              <p className="text-xs font-semibold text-slate-500">
                Keep this on Verification only until the ad network approves the site.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-start gap-2">
                <Shield className="mt-0.5 h-4 w-4 text-emerald-700" />
                <div>
                  <p className="text-sm font-extrabold text-emerald-950">Current safety behavior</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-emerald-900">
                    Disabled and Verification only modes leave user-facing ad slots invisible. No empty boxes or coming-soon messages are shown.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="font-bold text-slate-900">Google AdSense publisher ID</Label>
              <Input
                value={settings.adsensePublisherId}
                onChange={(event) => updatePublisherId(event.target.value)}
                placeholder="ca-pub-0000000000000000"
                className="border-slate-300 bg-white font-semibold text-slate-950"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-900">Default ad slot ID</Label>
              <Input
                value={settings.adsenseSlotId}
                onChange={(event) => updateSetting('adsenseSlotId', event.target.value)}
                placeholder="1234567890"
                className="border-slate-300 bg-white font-semibold text-slate-950"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div>
                <Label className="font-bold text-slate-900">Meta tag</Label>
                <p className="text-xs font-semibold text-slate-500">Adds google-adsense-account</p>
              </div>
              <Switch
                checked={settings.includeAdsenseMeta}
                onCheckedChange={(checked) => updateSetting('includeAdsenseMeta', checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div>
                <Label className="font-bold text-slate-900">AdSense script</Label>
                <p className="text-xs font-semibold text-slate-500">Adds async head script</p>
              </div>
              <Switch
                checked={settings.includeAdsenseScript}
                onCheckedChange={(checked) => updateSetting('includeAdsenseScript', checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div>
                <Label className="font-bold text-slate-900">ads.txt</Label>
                <p className="text-xs font-semibold text-slate-500">Serves {adsTxtUrl}</p>
              </div>
              <Switch
                checked={settings.enableAdsTxt}
                onCheckedChange={(checked) => updateSetting('enableAdsTxt', checked)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="font-bold text-slate-900">ads.txt content</Label>
              <a
                href={adsTxtUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700 hover:text-blue-900"
              >
                Open ads.txt
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <textarea
              value={settings.adsTxt}
              onChange={(event) => updateSetting('adsTxt', event.target.value)}
              placeholder="google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0"
              className="min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm font-semibold text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <h4 className="font-extrabold text-slate-950">Ad placements</h4>
              <p className="text-sm font-semibold text-slate-600">
                These render nothing unless status is Active and the specific placement is enabled.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(AD_PLACEMENT_LABELS).map(([placement, label]) => (
                <div key={placement} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div>
                    <Label className="font-bold text-slate-900">{label}</Label>
                    <p className="text-xs font-semibold text-slate-500">{placement}</p>
                  </div>
                  <Switch
                    checked={Boolean(settings.placements?.[placement])}
                    onCheckedChange={(checked) => updatePlacement(placement, checked)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSave} disabled={isSaving} className="bg-slate-800 font-extrabold text-white hover:bg-slate-900">
              {isSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Save Ad Settings
            </Button>
            <Badge variant={settings.status === 'active' ? 'default' : 'secondary'} className="px-3 py-1">
              {settings.status === 'disabled' ? 'Ads disabled' : settings.status === 'verification_only' ? 'Verification only' : 'Active ads'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-amber-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Pre-download Sponsored Offer</CardTitle>
          <CardDescription>
            Show an optional sponsored message before selected PDF downloads. Disabled offers render nothing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
            <div>
              <Label className="font-bold text-slate-900">Enable pre-download offer</Label>
              <p className="text-xs font-semibold text-slate-600">
                Users can still continue to the PDF after reviewing the sponsored resource.
              </p>
            </div>
            <Switch
              checked={pdfOffer.enabled}
              onCheckedChange={(checked) => updatePdfOffer('enabled', checked)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="font-bold text-slate-900">Disclosure label</Label>
              <Input
                value={pdfOffer.disclosureLabel}
                onChange={(event) => updatePdfOffer('disclosureLabel', event.target.value)}
                placeholder="Sponsored Resource"
                className="border-slate-300 bg-white font-semibold text-slate-950"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-900">Offer title</Label>
              <Input
                value={pdfOffer.title}
                onChange={(event) => updatePdfOffer('title', event.target.value)}
                placeholder="Before you download"
                className="border-slate-300 bg-white font-semibold text-slate-950"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-900">CTA label</Label>
              <Input
                value={pdfOffer.ctaLabel}
                onChange={(event) => updatePdfOffer('ctaLabel', event.target.value)}
                placeholder="Open sponsored resource"
                className="border-slate-300 bg-white font-semibold text-slate-950"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-900">CTA URL</Label>
              <Input
                value={pdfOffer.ctaUrl}
                onChange={(event) => updatePdfOffer('ctaUrl', event.target.value)}
                placeholder="/api/sponsor-links/example/go or https://..."
                className="border-slate-300 bg-white font-semibold text-slate-950"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-900">Continue button label</Label>
              <Input
                value={pdfOffer.continueLabel}
                onChange={(event) => updatePdfOffer('continueLabel', event.target.value)}
                placeholder="Continue to PDF"
                className="border-slate-300 bg-white font-semibold text-slate-950"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-900">Display frequency</Label>
              <select
                value={pdfOffer.frequency}
                onChange={(event) => updatePdfOffer('frequency', event.target.value as AdminPdfDownloadOfferSettings['frequency'])}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950"
              >
                <option value="once_per_session">Once per browser session</option>
                <option value="once_per_day">Once per day</option>
                <option value="always">Every matching download</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-bold text-slate-900">Offer body</Label>
            <textarea
              value={pdfOffer.bodyHtml}
              onChange={(event) => updatePdfOffer('bodyHtml', event.target.value)}
              placeholder={'Use plain text or safe HTML, e.g. <p>Download checklist from our sponsor.</p><a href="/api/sponsor-links/example/go">Open resource</a>'}
              className="min-h-32 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="font-extrabold text-slate-950">Show before these downloads</h4>
              <p className="text-sm font-semibold text-slate-600">
                Keep this narrow at first. The topic-completion placement is the recommended starting point.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(PDF_OFFER_SOURCE_LABELS).map(([source, label]) => (
                <div key={source} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div>
                    <Label className="font-bold text-slate-900">{label}</Label>
                    <p className="text-xs font-semibold text-slate-500">{source}</p>
                  </div>
                  <Switch
                    checked={Boolean(pdfOffer.sources?.[source])}
                    onCheckedChange={(checked) => updatePdfOfferSource(source, checked)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="font-extrabold text-slate-950">Native offer analytics</h4>
                <p className="text-sm font-semibold text-slate-600">
                  Tracked directly from the PDF dialog, even when the CTA URL is not a sponsor-link URL.
                </p>
              </div>
              <Badge variant="secondary" className="px-3 py-1">
                {pdfOfferStats.length ? `${pdfOfferStats.length} source rows` : 'No events yet'}
              </Badge>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border border-white bg-white/80 p-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                  <Eye className="h-3.5 w-3.5" />
                  Impressions
                </div>
                <p className="mt-1 text-xl font-extrabold text-slate-950">{pdfOfferTotals.impressions.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-white bg-white/80 p-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  Link clicks
                </div>
                <p className="mt-1 text-xl font-extrabold text-slate-950">{pdfOfferClickTotal.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-white bg-white/80 p-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                  <Download className="h-3.5 w-3.5" />
                  Continues
                </div>
                <p className="mt-1 text-xl font-extrabold text-slate-950">{pdfOfferTotals.continues.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-white bg-white/80 p-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                  <XCircle className="h-3.5 w-3.5" />
                  Not now
                </div>
                <p className="mt-1 text-xl font-extrabold text-slate-950">{pdfOfferTotals.dismissals.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-white bg-white/80 p-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                  <TrendingUp className="h-3.5 w-3.5" />
                  CTR
                </div>
                <p className="mt-1 text-xl font-extrabold text-slate-950">
                  {pdfOfferTotals.impressions ? `${Math.round((pdfOfferClickTotal / pdfOfferTotals.impressions) * 100)}%` : '0%'}
                </p>
              </div>
            </div>

            {pdfOfferStats.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-lg border border-blue-100 bg-white">
                {pdfOfferStats.slice(0, 8).map((row) => {
                  const impressions = Number(row.impressions || 0);
                  const clicks = Number(row.cta_clicks || 0) + Number(row.body_link_clicks || 0);
                  return (
                    <div key={`${row.offer_id}-${row.source}`} className="grid gap-2 border-b border-blue-50 px-3 py-2 text-sm last:border-b-0 md:grid-cols-[minmax(0,1fr)_repeat(4,auto)] md:items-center">
                      <div>
                        <p className="font-extrabold text-slate-900">{PDF_OFFER_SOURCE_LABELS[row.source] || row.source}</p>
                        <p className="font-mono text-[11px] font-semibold text-slate-500">{row.offer_id}</p>
                      </div>
                      <span className="font-semibold text-slate-700">{impressions.toLocaleString()} views</span>
                      <span className="font-semibold text-slate-700">{clicks.toLocaleString()} clicks</span>
                      <span className="font-semibold text-slate-700">{Number(row.continues || 0).toLocaleString()} continues</span>
                      <span className="font-semibold text-slate-700">{Number(row.dismissals || 0).toLocaleString()} not now</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(pdfOffer.bodyHtml.trim() || pdfOffer.title.trim()) && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-emerald-800">
                {pdfOffer.disclosureLabel || 'Sponsored Resource'}
              </div>
              <h4 className="font-extrabold text-slate-950">{pdfOffer.title || 'Before you download'}</h4>
              {pdfOffer.bodyHtml.trim() && (
                <RichMessageContent content={pdfOffer.bodyHtml} className="mt-3" />
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSavePdfOffer} disabled={isSavingOffer} className="bg-amber-600 font-extrabold text-white hover:bg-amber-700">
              {isSavingOffer ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Save PDF Offer
            </Button>
            <Badge variant={pdfOffer.enabled ? 'default' : 'secondary'} className="px-3 py-1">
              {pdfOffer.enabled ? 'Offer enabled' : 'Offer disabled'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const COOLIFY_ENVIRONMENT_URL = import.meta.env.VITE_COOLIFY_ENVIRONMENT_URL
  || 'http://coolify.peterdowney.tech:8000/project/xfx4ad1mmeym1e2e70n91u4g/environment/o6s3zqos2c585okjqh3vpur0/application/stslm34sk12x83ih2fufqht5/environment-variables';

function buildProviderEnvLines(provider: AdminProviderStatus) {
  const lines: string[] = [];

  if (provider.apiKeyEnvVar) {
    lines.push(`${provider.apiKeyEnvVar}=<paste ${provider.label} API key here>`);
  }

  if (provider.baseUrlEnvVar) {
    lines.push(`${provider.baseUrlEnvVar}=${provider.baseUrl || 'https://your-openai-compatible-host/v1'}`);
  }

  if (provider.defaultModelEnvVar) {
    lines.push(`${provider.defaultModelEnvVar}=${provider.defaultModel || 'auto'}`);
  }

  lines.push(`AI_DEFAULT_PROVIDER=${provider.provider}`);
  lines.push('AI_FALLBACK_PROVIDERS=unified,nvidia,deepseek,anthropic,openai');

  return lines;
}

const AI_ROLE_OPTIONS: Array<{ id: AdminAIRoleId; title: string; help: string }> = [
  {
    id: 'robin',
    title: 'Robin Interview Coach',
    help: 'USCIS marriage interview practice, preparation, and attorney-resource routing only.',
  },
  {
    id: 'support',
    title: 'User Support Assistant',
    help: 'Billing, refunds, account access, app support, and ticket triage.',
  },
  {
    id: 'admin_support',
    title: 'Admin Support Drafts',
    help: 'Admin-facing ticket summaries, reply drafts, urgency, and refund review notes.',
  },
];

const DEFAULT_ROLE_TIMEOUTS: Record<AdminAIRoleId, number> = {
  robin: 25,
  support: 15,
  admin_support: 25,
};

const DEFAULT_ROLE_SETTINGS = AI_ROLE_OPTIONS.reduce((acc, role) => {
  acc[role.id] = {
    label: role.title,
    routingPolicy: role.id === 'robin' ? 'complexity' : role.id === 'support' ? 'support_triage' : 'admin_triage',
    defaultModelRef: '',
    enabledModelRefs: [],
    fallbackModelRefs: [],
    fallbackTimeoutSeconds: DEFAULT_ROLE_TIMEOUTS[role.id],
  };
  return acc;
}, {} as NonNullable<AdminAISettings['roleAssignments']>);

const DEFAULT_ROBIN_USAGE_SETTINGS: AdminRobinUsageSettings = {
  dailyFreeMessages: 10,
  dailyResetTimezone: 'America/New_York',
  emergencyPause: false,
  pauseMessage: 'Robin is temporarily paused while we tune the free app experience. Please try again soon.',
  freeMessagesRollover: false,
  paidMessagesRollover: true,
  paidCreditExpirationDays: 365,
  paidPacks: [
    { id: 'starter', label: 'Starter Pack', messages: 50, priceCents: 500, expirationDays: 365, rollover: true, active: true },
    { id: 'practice', label: 'Practice Pack', messages: 150, priceCents: 1200, expirationDays: 365, rollover: true, active: true },
    { id: 'intensive', label: 'Interview Week Pack', messages: 500, priceCents: 3000, expirationDays: 365, rollover: true, active: true },
  ],
};

function modelRef(provider: string, model: string) {
  return `${provider}::${model}`;
}

function formatModelRef(ref: string) {
  const [provider, ...modelParts] = ref.split('::');
  const model = modelParts.join('::') || ref;
  return provider && modelParts.length ? `${provider} / ${model}` : ref;
}

function createBlankLawyer(): AdminLawyerDirectoryEntry {
  return {
    id: `lawyer-${Date.now()}`,
    active: true,
    name: '',
    firm: '',
    states: '',
    practiceAreas: 'Immigration, marriage green card interviews',
    description: '',
    website: '',
    affiliateUrl: '',
    imageUrl: '',
    email: '',
    phone: '',
    priority: 10,
  };
}

function createRobinPack(): AdminRobinMessagePack {
  return {
    id: `pack-${Date.now()}`,
    label: 'New Pack',
    messages: 100,
    priceCents: 900,
    expirationDays: 365,
    rollover: true,
    active: true,
  };
}

// AI Config Tab
function AIConfigTab() {
  const { status, isLoading, error, refresh } = useAdminSystemStatus();
  const memory = useAdminMemoryStatus();
  const [configureProvider, setConfigureProvider] = useState<AdminProviderStatus | null>(null);
  const [copyNotice, setCopyNotice] = useState('');
  const [aiSettings, setAiSettings] = useState<AdminAISettings | null>(null);
  const [welcomeSettings, setWelcomeSettings] = useState<AdminWelcomeMessageSettings | null>(null);
  const [lawyerSettings, setLawyerSettings] = useState<AdminLawyerDirectorySettings | null>(null);
  const [robinUsageSettings, setRobinUsageSettings] = useState<AdminRobinUsageSettings | null>(null);
  const [settingsNotice, setSettingsNotice] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [refreshingProvider, setRefreshingProvider] = useState<string | null>(null);

  const envLines = configureProvider ? buildProviderEnvLines(configureProvider) : [];
  const openCoolifyEnv = () => window.open(COOLIFY_ENVIRONMENT_URL, '_blank', 'noopener,noreferrer');
  const copyEnvBlock = async () => {
    if (!configureProvider) return;
    await navigator.clipboard.writeText(envLines.join('\n'));
    setCopyNotice('Copied environment variable names.');
    window.setTimeout(() => setCopyNotice(''), 2500);
  };

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      fetchAdminAISettings(),
      fetchAdminWelcomeMessages(),
      fetchAdminLawyerDirectory(),
      fetchAdminRobinUsageSettings(),
    ]).then((results) => {
      if (!mounted) return;
      const aiResult = results[0];
      const welcomeResult = results[1];
      const lawyerResult = results[2];
      const robinUsageResult = results[3];
      if (aiResult.status === 'fulfilled') setAiSettings(aiResult.value);
      if (welcomeResult.status === 'fulfilled') setWelcomeSettings(welcomeResult.value);
      if (lawyerResult.status === 'fulfilled') setLawyerSettings(lawyerResult.value);
      if (robinUsageResult.status === 'fulfilled') setRobinUsageSettings({ ...DEFAULT_ROBIN_USAGE_SETTINGS, ...robinUsageResult.value });
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (aiSettings || !status?.ai.settings) return;
    setAiSettings(status.ai.settings);
  }, [aiSettings, status]);

  const updateAIProviderSetting = (provider: string, patch: Partial<AdminAISettings['providers'][string]>) => {
    setAiSettings(prev => {
      const current = prev || {
        defaultProvider: status?.ai.defaultProvider || 'unified',
        defaultModel: status?.ai.defaultModel || 'auto',
        fallbackProviders: ['unified', 'nvidia', 'deepseek', 'anthropic', 'openai'],
        providers: {},
        modelCatalog: {},
        roleAssignments: DEFAULT_ROLE_SETTINGS,
      };
      return {
        ...current,
        providers: {
          ...current.providers,
          [provider]: {
            ...(current.providers[provider] || {}),
            ...patch,
          },
        },
      };
    });
  };

  const editableProviders: AdminProviderStatus[] = (() => {
    const baseProviders = [...(status?.ai.providers || [])];
    const known = new Set(baseProviders.map(provider => provider.provider));
    Object.entries(aiSettings?.providers || {}).forEach(([providerId, providerSetting]) => {
      if (known.has(providerId)) return;
      baseProviders.push({
        provider: providerId,
        label: providerSetting.label || providerId.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()),
        configured: Boolean(providerSetting.apiKeyConfigured || providerSetting.apiKey) && Boolean(providerSetting.baseUrl),
        defaultModel: providerSetting.defaultModel || 'auto',
        modelCount: aiSettings?.modelCatalog?.[providerId]?.length || 1,
        apiKeyConfigured: Boolean(providerSetting.apiKeyConfigured || providerSetting.apiKey),
        baseUrlConfigured: Boolean(providerSetting.baseUrl),
        baseUrl: providerSetting.baseUrl,
        openAICompatible: true,
        managedInAdmin: true,
        configurationHint: 'OpenAI-compatible provider managed from Admin settings.',
      });
    });
    return baseProviders;
  })();

  const availableModelRefs = editableProviders.flatMap(provider => {
    const providerSetting = aiSettings?.providers?.[provider.provider] || {};
    const catalogModels = aiSettings?.modelCatalog?.[provider.provider] || [];
    const models = Array.from(new Set([
      providerSetting.defaultModel,
      provider.defaultModel,
      ...catalogModels,
    ].filter(Boolean) as string[]));
    return models.map(model => modelRef(provider.provider, model));
  });

  const updateRoleAssignment = (roleId: AdminAIRoleId, patch: Partial<NonNullable<AdminAISettings['roleAssignments']>[AdminAIRoleId]>) => {
    setAiSettings(prev => {
      if (!prev) return prev;
      const currentRoles = { ...DEFAULT_ROLE_SETTINGS, ...(prev.roleAssignments || {}) };
      return {
        ...prev,
        roleAssignments: {
          ...currentRoles,
          [roleId]: {
            ...currentRoles[roleId],
            ...patch,
          },
        },
      };
    });
  };

  const toggleRoleModel = (roleId: AdminAIRoleId, ref: string, checked: boolean) => {
    const currentRoles = { ...DEFAULT_ROLE_SETTINGS, ...(aiSettings?.roleAssignments || {}) };
    const currentRole = currentRoles[roleId];
    const enabled = new Set(currentRole.enabledModelRefs || []);
    if (checked) enabled.add(ref);
    else enabled.delete(ref);
    const enabledModelRefs = Array.from(enabled);
    updateRoleAssignment(roleId, {
      enabledModelRefs,
      fallbackModelRefs: enabledModelRefs.filter(item => item !== currentRole.defaultModelRef),
      defaultModelRef: checked && !currentRole.defaultModelRef ? ref : currentRole.defaultModelRef,
    });
  };

  const selectAllRoleModels = (roleId: AdminAIRoleId) => {
    const currentRoles = { ...DEFAULT_ROLE_SETTINGS, ...(aiSettings?.roleAssignments || {}) };
    const defaultModelRef = currentRoles[roleId].defaultModelRef || availableModelRefs[0] || '';
    updateRoleAssignment(roleId, {
      defaultModelRef,
      enabledModelRefs: availableModelRefs,
      fallbackModelRefs: availableModelRefs.filter(ref => ref !== defaultModelRef),
    });
  };

  const clearRoleModels = (roleId: AdminAIRoleId) => {
    updateRoleAssignment(roleId, {
      defaultModelRef: '',
      enabledModelRefs: [],
      fallbackModelRefs: [],
    });
  };

  const refreshProviderModels = async (provider: AdminProviderStatus) => {
    if (!aiSettings) return;
    setRefreshingProvider(provider.provider);
    setSettingsNotice('');
    try {
      const models = await refreshAdminAIProviderModels(provider.provider, aiSettings.providers?.[provider.provider] || {});
      setAiSettings(prev => prev ? {
        ...prev,
        modelCatalog: {
          ...(prev.modelCatalog || {}),
          [provider.provider]: models,
        },
      } : prev);
      setSettingsNotice(`Loaded ${models.length} model${models.length === 1 ? '' : 's'} from ${provider.label}. Save settings to keep this list.`);
    } catch (err) {
      setSettingsNotice(err instanceof Error ? err.message : `Unable to refresh ${provider.label} models`);
    } finally {
      setRefreshingProvider(null);
    }
  };

  const addCustomProvider = () => {
    setAiSettings(prev => {
      if (!prev) return prev;
      const nextId = `custom_llm_${Date.now()}`;
      return {
        ...prev,
        providers: {
          ...prev.providers,
          [nextId]: {
            enabled: true,
            label: 'Custom LLM API',
            openAICompatible: true,
            custom: true,
            baseUrl: '',
            defaultModel: 'auto',
          },
        },
      };
    });
  };

  const saveAISettings = async () => {
    if (!aiSettings) return;
    setIsSavingSettings(true);
    setSettingsNotice('');
    try {
      const saved = await saveAdminAISettings(aiSettings);
      setAiSettings(saved);
      setSettingsNotice('AI role routing settings saved. New Robin and support requests will use this configuration.');
      await refresh();
    } catch (err) {
      setSettingsNotice(err instanceof Error ? err.message : 'Unable to save AI settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const saveWelcomeSettings = async () => {
    if (!welcomeSettings) return;
    setIsSavingSettings(true);
    setSettingsNotice('');
    try {
      setWelcomeSettings(await saveAdminWelcomeMessages(welcomeSettings));
      setSettingsNotice('Automatic welcome and upgrade messages saved.');
    } catch (err) {
      setSettingsNotice(err instanceof Error ? err.message : 'Unable to save welcome messages');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const updateRobinPack = (index: number, patch: Partial<AdminRobinMessagePack>) => {
    setRobinUsageSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        paidPacks: prev.paidPacks.map((pack, packIndex) => (
          packIndex === index ? { ...pack, ...patch } : pack
        )),
      };
    });
  };

  const saveRobinUsageSettings = async () => {
    if (!robinUsageSettings) return;
    setIsSavingSettings(true);
    setSettingsNotice('');
    try {
      const saved = await saveAdminRobinUsageSettings(robinUsageSettings);
      setRobinUsageSettings({ ...DEFAULT_ROBIN_USAGE_SETTINGS, ...saved });
      setSettingsNotice('Robin usage limits saved. New Robin requests will use these free-app limits immediately.');
    } catch (err) {
      setSettingsNotice(err instanceof Error ? err.message : 'Unable to save Robin usage limits');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const updateLawyer = (index: number, patch: Partial<AdminLawyerDirectoryEntry>) => {
    setLawyerSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        lawyers: prev.lawyers.map((lawyer, lawyerIndex) => (
          lawyerIndex === index ? { ...lawyer, ...patch } : lawyer
        )),
      };
    });
  };

  const saveLawyerSettings = async () => {
    if (!lawyerSettings) return;
    setIsSavingSettings(true);
    setSettingsNotice('');
    try {
      setLawyerSettings(await saveAdminLawyerDirectory(lawyerSettings));
      setSettingsNotice('Affiliate lawyer directory saved. Robin can reference active entries when users ask for attorney help.');
    } catch (err) {
      setSettingsNotice(err instanceof Error ? err.message : 'Unable to save lawyer directory');
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      <StatusLoadState isLoading={isLoading} error={error} onRefresh={refresh} />

      {robinUsageSettings && (
        <Card className="border-2 border-indigo-200 bg-gradient-to-br from-white via-indigo-50/80 to-cyan-50/70 shadow-lg shadow-indigo-100/60">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">Robin Free Usage Limits</CardTitle>
                <CardDescription>Set the daily free message limit, emergency pause, and paid message pack templates.</CardDescription>
              </div>
              <Badge variant={robinUsageSettings.emergencyPause ? 'destructive' : 'secondary'} className="w-fit px-3 py-1">
                {robinUsageSettings.emergencyPause ? 'Robin paused' : 'Robin active'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-900">Daily free messages</Label>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={robinUsageSettings.dailyFreeMessages}
                    onChange={(event) => setRobinUsageSettings(prev => prev ? {
                      ...prev,
                      dailyFreeMessages: Number(event.target.value) || 1,
                    } : prev)}
                    className="bg-white font-semibold text-slate-950"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-900">Reset timezone</Label>
                  <Input
                    value={robinUsageSettings.dailyResetTimezone}
                    onChange={(event) => setRobinUsageSettings(prev => prev ? {
                      ...prev,
                      dailyResetTimezone: event.target.value,
                    } : prev)}
                    placeholder="America/New_York"
                    className="bg-white font-semibold text-slate-950"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-rose-100 bg-white/90 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="font-bold text-slate-900">Emergency pause Robin</Label>
                    <p className="text-xs font-semibold leading-5 text-slate-600">
                      Blocks new Robin provider calls immediately while keeping the rest of the app available.
                    </p>
                  </div>
                  <Switch
                    checked={robinUsageSettings.emergencyPause}
                    onCheckedChange={(checked) => setRobinUsageSettings(prev => prev ? {
                      ...prev,
                      emergencyPause: checked,
                    } : prev)}
                  />
                </div>
                <textarea
                  value={robinUsageSettings.pauseMessage}
                  onChange={(event) => setRobinUsageSettings(prev => prev ? {
                    ...prev,
                    pauseMessage: event.target.value,
                  } : prev)}
                  className="mt-3 min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div>
                  <Label className="font-bold text-slate-900">Paid messages roll over</Label>
                  <p className="text-xs font-semibold text-slate-500">Daily free messages never roll over.</p>
                </div>
                <Switch
                  checked={robinUsageSettings.paidMessagesRollover}
                  onCheckedChange={(checked) => setRobinUsageSettings(prev => prev ? {
                    ...prev,
                    paidMessagesRollover: checked,
                  } : prev)}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-slate-900">Paid credit expiration days</Label>
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  value={robinUsageSettings.paidCreditExpirationDays}
                  onChange={(event) => setRobinUsageSettings(prev => prev ? {
                    ...prev,
                    paidCreditExpirationDays: Number(event.target.value) || 365,
                  } : prev)}
                  className="bg-white font-semibold text-slate-950"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-950">Paid message pack templates</h4>
                  <p className="text-sm font-semibold text-slate-600">
                    These define the top-up products shown on Robin when Stripe checkout is configured.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRobinUsageSettings(prev => prev ? {
                    ...prev,
                    paidPacks: [...prev.paidPacks, createRobinPack()],
                  } : prev)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add pack
                </Button>
              </div>

              <div className="grid gap-3">
                {robinUsageSettings.paidPacks.map((pack, index) => (
                  <div key={`${pack.id}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={pack.active ? 'default' : 'secondary'}>{pack.active ? 'Active' : 'Inactive'}</Badge>
                        <span className="text-xs font-semibold text-slate-500">{pack.id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={pack.active} onCheckedChange={(checked) => updateRobinPack(index, { active: checked })} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => setRobinUsageSettings(prev => prev ? {
                            ...prev,
                            paidPacks: prev.paidPacks.filter((_, packIndex) => packIndex !== index),
                          } : prev)}
                          aria-label="Remove pack"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-5">
                      <div className="space-y-2 md:col-span-2">
                        <Label className="font-bold text-slate-900">Pack label</Label>
                        <Input
                          value={pack.label}
                          onChange={(event) => updateRobinPack(index, { label: event.target.value })}
                          className="bg-white font-semibold text-slate-950"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bold text-slate-900">Messages</Label>
                        <Input
                          type="number"
                          min={1}
                          value={pack.messages}
                          onChange={(event) => updateRobinPack(index, { messages: Number(event.target.value) || 1 })}
                          className="bg-white font-semibold text-slate-950"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bold text-slate-900">Price cents</Label>
                        <Input
                          type="number"
                          min={0}
                          value={pack.priceCents}
                          onChange={(event) => updateRobinPack(index, { priceCents: Number(event.target.value) || 0 })}
                          className="bg-white font-semibold text-slate-950"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bold text-slate-900">Expires</Label>
                        <Input
                          type="number"
                          min={1}
                          value={pack.expirationDays}
                          onChange={(event) => updateRobinPack(index, { expirationDays: Number(event.target.value) || 365 })}
                          className="bg-white font-semibold text-slate-950"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <div>
                        <Label className="font-bold text-slate-900">This pack rolls over</Label>
                        <p className="text-xs font-semibold text-slate-500">Only applies to paid credits, not daily free messages.</p>
                      </div>
                      <Switch checked={pack.rollover} onCheckedChange={(checked) => updateRobinPack(index, { rollover: checked })} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={saveRobinUsageSettings} disabled={isSavingSettings} className="bg-gradient-to-r from-indigo-700 to-cyan-700 font-extrabold text-white">
              {isSavingSettings ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Save Robin Limits
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-2 border-emerald-200 bg-gradient-to-br from-white via-emerald-50/70 to-cyan-50/80 shadow-lg shadow-emerald-100/60">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Editable LLM Role Routing</CardTitle>
              <CardDescription>Add custom LLM APIs, refresh models, and assign model pools to Robin or support.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCustomProvider} disabled={!aiSettings}>
              <Plus className="mr-2 h-4 w-4" />
              Add custom API
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {aiSettings && (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-900">Default provider</Label>
                  <select
                    value={aiSettings.defaultProvider || status?.ai.defaultProvider || 'unified'}
                    onChange={(event) => setAiSettings(prev => prev ? { ...prev, defaultProvider: event.target.value } : prev)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950"
                  >
                    {editableProviders.map(provider => (
                      <option key={provider.provider} value={provider.provider}>{provider.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-900">Default model</Label>
                  <Input
                    value={aiSettings.defaultModel || status?.ai.defaultModel || 'auto'}
                    onChange={(event) => setAiSettings(prev => prev ? { ...prev, defaultModel: event.target.value } : prev)}
                    className="bg-white font-semibold text-slate-950"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-900">Fallback order</Label>
                  <Input
                    value={(aiSettings.fallbackProviders?.length ? aiSettings.fallbackProviders : ['unified', 'nvidia', 'deepseek', 'anthropic', 'openai']).join(', ')}
                    onChange={(event) => setAiSettings(prev => prev ? {
                      ...prev,
                      fallbackProviders: event.target.value.split(',').map(item => item.trim()).filter(Boolean),
                    } : prev)}
                    className="bg-white font-semibold text-slate-950"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {editableProviders.map(provider => {
                  const providerSetting = aiSettings.providers?.[provider.provider] || {};
                  return (
                    <div key={provider.provider} className="space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="font-extrabold text-slate-950">{providerSetting.label || provider.label}</h4>
                          <p className="text-xs font-semibold text-slate-600">{provider.openAICompatible ? 'OpenAI-compatible gateway' : 'Native provider'}</p>
                        </div>
                        <ConfigBadge configured={Boolean(provider.configured || providerSetting.apiKeyConfigured || providerSetting.apiKey)} />
                      </div>
                      {providerSetting.custom && (
                        <div className="space-y-2">
                          <Label className="font-bold text-slate-900">Provider label</Label>
                          <Input
                            value={providerSetting.label || ''}
                            onChange={(event) => updateAIProviderSetting(provider.provider, { label: event.target.value, openAICompatible: true, custom: true })}
                            placeholder="Moonshot, OpenRouter, Together AI..."
                            className="bg-white font-semibold text-slate-950"
                          />
                          <p className="text-xs font-semibold text-slate-500">Provider ID: {provider.provider}</p>
                        </div>
                      )}
                      {provider.openAICompatible && (
                        <Input
                          value={providerSetting.baseUrl ?? provider.baseUrl ?? ''}
                          onChange={(event) => updateAIProviderSetting(provider.provider, { baseUrl: event.target.value, openAICompatible: true })}
                          placeholder="Base URL ending in /v1"
                          className="bg-white font-semibold text-slate-950"
                        />
                      )}
                      <Input
                        type="password"
                        value={providerSetting.apiKey || ''}
                        onChange={(event) => updateAIProviderSetting(provider.provider, {
                          apiKey: event.target.value,
                          keepExistingApiKey: !event.target.value && Boolean(providerSetting.apiKeyConfigured),
                        })}
                        placeholder={providerSetting.apiKeyConfigured ? `Existing key ${providerSetting.apiKeyMasked || 'saved'} - leave blank to keep` : 'Paste API key'}
                        className="bg-white font-semibold text-slate-950"
                      />
                      <Input
                        value={providerSetting.defaultModel ?? provider.defaultModel ?? ''}
                        onChange={(event) => updateAIProviderSetting(provider.provider, { defaultModel: event.target.value })}
                        placeholder="Default model"
                        className="bg-white font-semibold text-slate-950"
                      />
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => refreshProviderModels(provider)}
                          disabled={refreshingProvider === provider.provider}
                          className="font-bold"
                        >
                          <RefreshCw className={cn('mr-2 h-4 w-4', refreshingProvider === provider.provider && 'animate-spin')} />
                          Refresh models
                        </Button>
                        <span className="text-xs font-semibold text-slate-600">
                          {(aiSettings.modelCatalog?.[provider.provider]?.length || 0).toLocaleString()} loaded
                        </span>
                      </div>
                      {Boolean(aiSettings.modelCatalog?.[provider.provider]?.length) && (
                        <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-700">
                          {(aiSettings.modelCatalog?.[provider.provider] || []).slice(0, 12).map(model => (
                            <div key={model} className="truncate">{model}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3 rounded-2xl border border-indigo-200 bg-gradient-to-br from-white via-indigo-50/70 to-cyan-50/80 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-950">Assign models by AI duty</h4>
                    <p className="text-sm font-semibold text-slate-700">
                      Robin, user support, and Admin support drafts can use different defaults and fallback pools.
                    </p>
                  </div>
                  <Badge className="w-fit border-0 bg-indigo-100 text-indigo-800">
                    {availableModelRefs.length} available models
                  </Badge>
                </div>

                {availableModelRefs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-indigo-200 bg-white/80 px-4 py-5 text-sm font-semibold text-slate-700">
                    Add a provider default model or refresh provider models to start assigning model pools.
                  </div>
                ) : (
                  <div className="grid gap-3 xl:grid-cols-3">
                    {AI_ROLE_OPTIONS.map(role => {
                      const roleSettings = { ...DEFAULT_ROLE_SETTINGS[role.id], ...(aiSettings.roleAssignments?.[role.id] || {}) };
                      const selectedRefs = new Set(roleSettings.enabledModelRefs || []);
                      return (
                        <div key={role.id} className="space-y-3 rounded-xl border border-indigo-100 bg-white/95 p-3 shadow-sm">
                          <div>
                            <h5 className="font-extrabold text-slate-950">{role.title}</h5>
                            <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{role.help}</p>
                          </div>

                          <div className="space-y-2">
                            <Label className="font-bold text-slate-900">Default model</Label>
                            <select
                              value={roleSettings.defaultModelRef || ''}
                              onChange={(event) => {
                                const nextRef = event.target.value;
                                const enabled = Array.from(new Set([nextRef, ...(roleSettings.enabledModelRefs || [])].filter(Boolean)));
                                updateRoleAssignment(role.id, {
                                  defaultModelRef: nextRef,
                                  enabledModelRefs: enabled,
                                  fallbackModelRefs: enabled.filter(ref => ref !== nextRef),
                                });
                              }}
                              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-950"
                            >
                              <option value="">Use global default</option>
                              {availableModelRefs.map(ref => (
                                <option key={ref} value={ref}>{formatModelRef(ref)}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <Label className="font-bold text-slate-900">Routing policy</Label>
                            <select
                              value={roleSettings.routingPolicy || 'fallback'}
                              onChange={(event) => updateRoleAssignment(role.id, { routingPolicy: event.target.value })}
                              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-950"
                            >
                              <option value="complexity">Complexity based</option>
                              <option value="support_triage">Support triage</option>
                              <option value="admin_triage">Admin triage</option>
                              <option value="fallback">Default then fallback</option>
                              <option value="cost_first">Cost first</option>
                              <option value="quality_first">Quality first</option>
                            </select>
                          </div>

                          <div className="space-y-2">
                            <Label className="font-bold text-slate-900">Fallback timeout</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={8}
                                max={120}
                                step={1}
                                value={roleSettings.fallbackTimeoutSeconds ?? DEFAULT_ROLE_TIMEOUTS[role.id]}
                                onChange={(event) => {
                                  const parsed = Number.parseInt(event.target.value, 10);
                                  const next = Number.isFinite(parsed)
                                    ? Math.max(8, Math.min(120, parsed))
                                    : DEFAULT_ROLE_TIMEOUTS[role.id];
                                  updateRoleAssignment(role.id, { fallbackTimeoutSeconds: next });
                                }}
                                className="h-10 w-24 border-slate-300 bg-white text-xs font-bold text-slate-950"
                              />
                              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">seconds</span>
                            </div>
                            <p className="text-xs font-semibold leading-5 text-slate-600">
                              If the current model does not answer in time, the next fallback model is tried.
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => selectAllRoleModels(role.id)}>
                              Select all
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => clearRoleModels(role.id)}>
                              Deselect all
                            </Button>
                          </div>

                          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                            {availableModelRefs.map(ref => (
                              <label key={ref} className="flex items-start gap-2 rounded-lg bg-white px-2 py-2 text-xs font-bold text-slate-800 shadow-sm">
                                <input
                                  type="checkbox"
                                  checked={selectedRefs.has(ref)}
                                  onChange={(event) => toggleRoleModel(role.id, ref, event.target.checked)}
                                  className="mt-0.5 h-4 w-4 accent-indigo-700"
                                />
                                <span className="min-w-0 flex-1 break-all">{formatModelRef(ref)}</span>
                                {roleSettings.defaultModelRef === ref && (
                                  <Badge variant="secondary" className="shrink-0 bg-emerald-100 text-emerald-800">Default</Badge>
                                )}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  Current live default: {status?.ai.defaultProvider || 'unknown'} / {status?.ai.defaultModel || 'unknown'}
                </p>
                <Button onClick={saveAISettings} disabled={isSavingSettings} className="bg-gradient-to-r from-emerald-700 to-cyan-700 text-white">
                  {isSavingSettings ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Save LLM Settings
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {welcomeSettings && (
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-white via-blue-50/70 to-amber-50/60 shadow-lg shadow-blue-100/60">
          <CardHeader>
            <CardTitle className="text-base">Automatic Dashboard Messages</CardTitle>
            <CardDescription>Send a welcome message after signup and an unlock message after upgrade.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-blue-100 bg-white/90 p-4">
                <label className="flex items-center justify-between gap-3 font-bold text-slate-900">
                  Signup welcome
                  <Switch checked={welcomeSettings.signupEnabled} onCheckedChange={(checked) => setWelcomeSettings(prev => prev ? { ...prev, signupEnabled: checked } : prev)} />
                </label>
                <Input value={welcomeSettings.signupTitle} onChange={(event) => setWelcomeSettings(prev => prev ? { ...prev, signupTitle: event.target.value } : prev)} className="font-semibold text-slate-950" />
                <textarea value={welcomeSettings.signupMessage} onChange={(event) => setWelcomeSettings(prev => prev ? { ...prev, signupMessage: event.target.value } : prev)} className="min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950" />
              </div>
              <div className="space-y-3 rounded-2xl border border-amber-100 bg-white/90 p-4">
                <label className="flex items-center justify-between gap-3 font-bold text-slate-900">
                  Upgrade welcome
                  <Switch checked={welcomeSettings.upgradeEnabled} onCheckedChange={(checked) => setWelcomeSettings(prev => prev ? { ...prev, upgradeEnabled: checked } : prev)} />
                </label>
                <Input value={welcomeSettings.upgradeTitle} onChange={(event) => setWelcomeSettings(prev => prev ? { ...prev, upgradeTitle: event.target.value } : prev)} className="font-semibold text-slate-950" />
                <textarea value={welcomeSettings.upgradeMessage} onChange={(event) => setWelcomeSettings(prev => prev ? { ...prev, upgradeMessage: event.target.value } : prev)} className="min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950" />
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Switch checked={welcomeSettings.sendEmail} onCheckedChange={(checked) => setWelcomeSettings(prev => prev ? { ...prev, sendEmail: checked } : prev)} />
                Also send email alerts
              </label>
              <Button onClick={saveWelcomeSettings} disabled={isSavingSettings} className="bg-gradient-to-r from-blue-700 to-cyan-700 text-white">
                Save Automatic Messages
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {lawyerSettings && (
        <Card className="border-2 border-amber-200 bg-gradient-to-br from-white via-amber-50/70 to-emerald-50/70 shadow-lg shadow-amber-100/60">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">Affiliate Lawyer Directory for Robin</CardTitle>
                <CardDescription>
                  Preload approved lawyer resources. Robin can show these links and images only when users ask for attorney help.
                </CardDescription>
              </div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Switch checked={lawyerSettings.enabled} onCheckedChange={(checked) => setLawyerSettings(prev => prev ? { ...prev, enabled: checked } : prev)} />
                Enabled
              </label>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="font-bold text-slate-900">Robin intro instruction</Label>
                <textarea
                  value={lawyerSettings.introText}
                  onChange={(event) => setLawyerSettings(prev => prev ? { ...prev, introText: event.target.value } : prev)}
                  className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-slate-900">Affiliate/legal disclosure</Label>
                <textarea
                  value={lawyerSettings.affiliateDisclosure}
                  onChange={(event) => setLawyerSettings(prev => prev ? { ...prev, affiliateDisclosure: event.target.value } : prev)}
                  className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="font-extrabold text-slate-950">Lawyer entries</h4>
                <p className="text-sm font-semibold text-slate-700">Active entries are available to Robin. Inactive entries stay saved but hidden from recommendations.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLawyerSettings(prev => prev ? { ...prev, lawyers: [...prev.lawyers, createBlankLawyer()] } : prev)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add lawyer
              </Button>
            </div>

            <div className="space-y-3">
              {lawyerSettings.lawyers.length === 0 && (
                <div className="rounded-xl border border-dashed border-amber-200 bg-white/80 px-4 py-6 text-center text-sm font-semibold text-slate-700">
                  No lawyers added yet.
                </div>
              )}
              {lawyerSettings.lawyers.map((lawyer, index) => (
                <div key={lawyer.id || index} className="space-y-3 rounded-2xl border border-amber-100 bg-white/95 p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                      <Switch checked={lawyer.active} onCheckedChange={(checked) => updateLawyer(index, { active: checked })} />
                      Active for Robin
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-rose-200 text-rose-700 hover:bg-rose-50"
                      onClick={() => setLawyerSettings(prev => prev ? { ...prev, lawyers: prev.lawyers.filter((_, lawyerIndex) => lawyerIndex !== index) } : prev)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={lawyer.name} onChange={(event) => updateLawyer(index, { name: event.target.value })} className="font-semibold text-slate-950" />
                    </div>
                    <div className="space-y-2">
                      <Label>Firm</Label>
                      <Input value={lawyer.firm} onChange={(event) => updateLawyer(index, { firm: event.target.value })} className="font-semibold text-slate-950" />
                    </div>
                    <div className="space-y-2">
                      <Label>States served</Label>
                      <Input value={lawyer.states} onChange={(event) => updateLawyer(index, { states: event.target.value })} placeholder="CA, TX, NY, Online" className="font-semibold text-slate-950" />
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Input type="number" value={lawyer.priority} onChange={(event) => updateLawyer(index, { priority: Number(event.target.value || 10) })} className="font-semibold text-slate-950" />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Practice areas</Label>
                      <Input value={lawyer.practiceAreas} onChange={(event) => updateLawyer(index, { practiceAreas: event.target.value })} className="font-semibold text-slate-950" />
                    </div>
                    <div className="space-y-2">
                      <Label>Image URL</Label>
                      <Input value={lawyer.imageUrl} onChange={(event) => updateLawyer(index, { imageUrl: event.target.value })} placeholder="https://..." className="font-semibold text-slate-950" />
                    </div>
                    <div className="space-y-2">
                      <Label>Website</Label>
                      <Input value={lawyer.website} onChange={(event) => updateLawyer(index, { website: event.target.value })} placeholder="https://..." className="font-semibold text-slate-950" />
                    </div>
                    <div className="space-y-2">
                      <Label>Affiliate URL</Label>
                      <Input value={lawyer.affiliateUrl} onChange={(event) => updateLawyer(index, { affiliateUrl: event.target.value })} placeholder="https://affiliate-link..." className="font-semibold text-slate-950" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={lawyer.email} onChange={(event) => updateLawyer(index, { email: event.target.value })} className="font-semibold text-slate-950" />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={lawyer.phone} onChange={(event) => updateLawyer(index, { phone: event.target.value })} className="font-semibold text-slate-950" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <textarea
                      value={lawyer.description}
                      onChange={(event) => updateLawyer(index, { description: event.target.value })}
                      className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button onClick={saveLawyerSettings} disabled={isSavingSettings} className="bg-gradient-to-r from-amber-600 to-emerald-700 text-white">
                Save Lawyer Directory
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {settingsNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          {settingsNotice}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">AI API Configuration</CardTitle>
              <CardDescription>Live provider status from server environment variables.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {editableProviders.map((provider) => (
              <div
                key={provider.provider}
                className={cn(
                  'rounded-xl border p-4 shadow-sm',
                  provider.configured
                    ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50'
                    : 'border-amber-200 bg-gradient-to-br from-amber-50 via-white to-slate-50'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-slate-950">{provider.label}</h4>
                      {provider.openAICompatible && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          OpenAI-compatible
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 mt-1">{provider.defaultModel}</p>
                    {provider.baseUrl && (
                      <p className="mt-2 truncate text-xs text-slate-600" title={provider.baseUrl}>
                        Base URL: {provider.baseUrl}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <ConfigBadge configured={provider.configured} />
                    <Button
                      type="button"
                      size="sm"
                      variant={provider.configured ? 'outline' : 'default'}
                      onClick={() => {
                        setConfigureProvider(provider);
                        setCopyNotice('');
                      }}
                      className={cn(
                        'font-semibold',
                        !provider.configured && 'bg-blue-700 text-white hover:bg-blue-800'
                      )}
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Configure
                    </Button>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
                  <span>{provider.modelCount} models available</span>
                  <span>
                    {provider.configured
                        ? 'Enabled for Robin practice'
                      : provider.openAICompatible && !provider.baseUrlConfigured
                        ? 'Add key and base URL above'
                        : 'Add API key above'}
                  </span>
                </div>
                {(provider.apiKeyEnvVar || provider.baseUrlEnvVar || provider.defaultModelEnvVar) && (
                  <div className="mt-3 grid grid-cols-1 gap-1 rounded-lg bg-white/80 p-3 text-xs text-slate-700 ring-1 ring-slate-200">
                    {provider.apiKeyEnvVar && <span>Key: <span className="font-mono">{provider.apiKeyEnvVar}</span></span>}
                    {provider.baseUrlEnvVar && <span>Base URL: <span className="font-mono">{provider.baseUrlEnvVar}</span></span>}
                    {provider.defaultModelEnvVar && <span>Default model: <span className="font-mono">{provider.defaultModelEnvVar}</span></span>}
                  </div>
                )}
                {provider.configurationHint && (
                  <p className="mt-3 text-xs text-slate-600">{provider.configurationHint}</p>
                )}
              </div>
            ))}

            {!isLoading && !editableProviders.length && (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500 md:col-span-2">
                Provider status is unavailable.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Default provider</div>
                <div className="mt-1 font-medium text-slate-800">{status?.ai.defaultProvider || 'Not loaded'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Default model</div>
                <div className="mt-1 font-medium text-slate-800">{status?.ai.defaultModel || 'Not loaded'}</div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-600 p-2 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-950">Add More LLM Gateways</h4>
                <p className="text-sm text-slate-700">
                  Use the editable routing panel above for Robin's live providers, models, keys, and fallback order.
                  Brand-new custom gateway types can still be registered with
                  <span className="font-mono"> AI_OPENAI_COMPATIBLE_PROVIDERS</span> when needed.
                </p>
                <div className="rounded-lg bg-white/85 p-3 text-xs text-slate-700 ring-1 ring-blue-100">
                  <div><span className="font-mono">AI_FALLBACK_PROVIDERS</span>: unified,nvidia,deepseek,anthropic,openai</div>
                  <div><span className="font-mono">AI_OPENAI_COMPATIBLE_PROVIDERS</span>: provider id, label, base URL env, key env, default model</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-slate-700">How settings are applied</h4>
            <p className="text-sm text-slate-600">
              Admin-saved routing settings override environment defaults immediately for new Robin requests.
              If a key, model, or base URL is left blank here, the server falls back to the matching runtime variable.
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!configureProvider} onOpenChange={(open) => !open && setConfigureProvider(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-slate-950">
              Configure {configureProvider?.label}
            </DialogTitle>
            <DialogDescription className="text-slate-700">
              Use the Editable LLM Routing card for normal key and model changes. These environment variables remain available as a secure fallback.
            </DialogDescription>
          </DialogHeader>

          {configureProvider && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                <div className="font-extrabold">Fallback environment setup</div>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>For day-to-day changes, edit this provider in the Editable LLM Routing card above.</li>
                  <li>If you prefer environment secrets, open this app in Coolify.</li>
                  <li>Go to <span className="font-semibold">Configuration</span> then <span className="font-semibold">Environment Variables</span>.</li>
                  <li>Add or update the variables below, make them available at runtime, save, then redeploy.</li>
                </ol>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-extrabold text-slate-950">Variables to set</div>
                    <div className="text-sm text-slate-600">Paste your real key in place of the placeholder.</div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={copyEnvBlock}>
                    <Copy className="h-4 w-4" />
                    Copy block
                  </Button>
                </div>
                <div className="space-y-2">
                  {envLines.map((line) => (
                    <code
                      key={line}
                      className="block overflow-x-auto rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-950"
                    >
                      {line}
                    </code>
                  ))}
                </div>
                {copyNotice && <div className="mt-3 text-sm font-semibold text-emerald-700">{copyNotice}</div>}
              </div>

              {configureProvider.openAICompatible && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                  <div className="font-extrabold">OpenAI-compatible gateway note</div>
                  <p className="mt-1">
                    For your unified LLM proxy, keep the base URL ending in <span className="font-mono font-bold">/v1</span>.
                    Use <span className="font-mono font-bold">auto</span> as the default model if the gateway routes models itself.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="button" onClick={openCoolifyEnv} className="bg-slate-950 text-white hover:bg-slate-800">
                  <ExternalLink className="h-4 w-4" />
                  Open Coolify Environment Variables
                </Button>
                <Button type="button" variant="outline" onClick={() => setConfigureProvider(null)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage Limits</CardTitle>
          <CardDescription>Current plan limits used by the entitlement system.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(memory.status?.planLimits || []).map((plan) => (
            <div key={plan.plan_type} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <div className="font-medium text-slate-800">{plan.name}</div>
                <div className="text-sm text-slate-500">
                  {plan.max_turns_per_session} daily Robin chats
                </div>
              </div>
              <Badge variant={plan.can_choose_provider ? 'default' : 'secondary'}>
                {plan.can_choose_provider ? 'Provider choice' : 'Default AI'}
              </Badge>
            </div>
          ))}
          {!memory.isLoading && !memory.status?.planLimits.length && (
            <div className="text-sm text-slate-500">Plan limits are unavailable.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Memory Bank and Indexing</CardTitle>
              <CardDescription>Live status for Robin memory, captured answers, and expansion pages.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={memory.refresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatusLoadState isLoading={memory.isLoading} error={memory.error} onRefresh={memory.refresh} />
          {memory.status && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Robin chat memory</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{memory.status.dashboardAgentMemory?.total_entries || 0}</div>
                  <div className="text-xs text-indigo-700">
                    {memory.status.dashboardAgentMemory?.users_with_agent_memory || 0} users, {memory.status.dashboardAgentMemory?.captured_today || 0} today
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Captured answers</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{memory.status.answerCandidates.total_candidates || 0}</div>
                  <div className="text-xs text-slate-500">{memory.status.answerCandidates.pending_review || 0} pending review</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approved for public use</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{memory.status.answerCandidates.approved_for_publication || 0}</div>
                  <div className="text-xs text-slate-500">{memory.status.answerCandidates.published_examples || 0} published examples</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expansion pages</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{memory.status.seoExpansionPages.published_pages || 0}</div>
                  <div className="text-xs text-slate-500">{memory.status.seoExpansionPages.sitemap_pages || 0} in sitemap</div>
                </div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                Robin chats are indexed in the private dashboard memory table for that user's future Robin context. Captured practice answers are separate: they are sanitized and queued for manual public-example review, and original answers stay private unless an admin opens a candidate detail.
              </div>
              {memory.status.notes.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <div className="mb-2 font-semibold text-slate-900">Indexing notes</div>
                  <ul className="list-disc space-y-1 pl-5">
                    {memory.status.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// System Tab
function SystemTab() {
  const { status, isLoading, error, refresh } = useAdminSystemStatus();
  const [apiHealth, setApiHealth] = useState({
    isChecking: true,
    ok: false,
    message: 'Checking API health...',
  });

  const checkApiHealth = useCallback(async () => {
    setApiHealth(prev => ({ ...prev, isChecking: true }));
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || response.statusText || 'API health check failed');
      }
      setApiHealth({
        isChecking: false,
        ok: true,
        message: payload.status || payload.message || 'API is reachable',
      });
    } catch (err) {
      setApiHealth({
        isChecking: false,
        ok: false,
        message: err instanceof Error ? err.message : 'API is not reachable',
      });
    }
  }, []);

  useEffect(() => {
    void checkApiHealth();
  }, [checkApiHealth]);

  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : 'Browser origin unavailable';
  const adminApiReady = Boolean(status && !error);

  return (
    <div className="space-y-6">
      <StatusLoadState isLoading={isLoading} error={error} onRefresh={refresh} />

      <Card className="border-2 border-emerald-100 bg-gradient-to-br from-white via-emerald-50/70 to-cyan-50/60">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Admin Readiness Check</CardTitle>
              <CardDescription>Quick local/deploy checks before testing downloads, ads, broadcasts, or Robin limits.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void checkApiHealth();
                  refresh();
                }}
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', (apiHealth.isChecking || isLoading) && 'animate-spin')} />
                Recheck
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Browser origin</div>
              <div className="mt-1 break-all text-sm font-semibold text-slate-800">{browserOrigin}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">API health</div>
              <div className="mt-2">
                <Badge
                  variant="outline"
                  className={apiHealth.ok
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                  }
                >
                  {apiHealth.isChecking ? 'Checking' : apiHealth.ok ? 'Reachable' : 'Needs setup'}
                </Badge>
              </div>
              <div className="mt-2 text-xs font-semibold text-slate-500">{apiHealth.message}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin API</div>
              <div className="mt-2">
                <Badge
                  variant="outline"
                  className={adminApiReady
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                  }
                >
                  {isLoading ? 'Checking' : adminApiReady ? 'Ready' : 'Needs login/setup'}
                </Badge>
              </div>
              <div className="mt-2 text-xs font-semibold text-slate-500">
                {error || (adminApiReady ? 'Admin-only routes are responding.' : 'Open an admin session to test private routes.')}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Database URL</div>
              <div className="mt-2"><ConfigBadge configured={Boolean(status?.database.urlConfigured)} /></div>
              <div className="mt-2 text-xs font-semibold text-slate-500">
                Required for reports, sponsor clicks, user analytics, and downloads.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Production Configuration</CardTitle>
              <CardDescription>Read-only status for the deployed server.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Environment</div>
              <div className="mt-1 font-medium text-slate-800">{status?.environment || 'Unknown'}</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Database</div>
              <div className="mt-2"><ConfigBadge configured={Boolean(status?.database.urlConfigured)} /></div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stripe checkout</div>
              <div className="mt-2"><ConfigBadge configured={Boolean(status?.stripe.checkoutReady)} /></div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stripe webhook</div>
              <div className="mt-2"><ConfigBadge configured={Boolean(status?.stripe.webhookReady)} /></div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Mail className="h-3.5 w-3.5" />
                Email
              </div>
              <div className="mt-2"><ConfigBadge configured={Boolean(status?.email.plunkConfigured)} /></div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="font-medium text-slate-800">Server time</div>
            <div>{status?.serverTime ? new Date(status.serverTime).toLocaleString() : 'Not loaded'}</div>
            {status?.frontendUrl && (
              <>
                <div className="font-medium text-slate-800 mt-3">Frontend URL</div>
                <div className="break-all">{status.frontendUrl}</div>
              </>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="font-medium text-slate-800">Transactional email</div>
            <div className="mt-1">
              Provider: <span className="font-medium">{status?.email.provider || 'Not loaded'}</span>
            </div>
            <div className="mt-1">
              Welcome, password reset, and purchase confirmation emails use the configured server email provider.
            </div>
            {status?.email.fromAddress && (
              <div className="mt-2 break-all">From: {status.email.fromAddress}</div>
            )}
            {status?.email.apiUrl && (
              <div className="mt-1 break-all">API: {status.email.apiUrl}</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operational Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            Test-mode payments require matching Stripe test price IDs in Coolify. Once checkout succeeds,
            the Stripe webhook is what updates the user subscription from trial to paid in the database.
          </div>
          <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
            Robin's provider keys and fallback models can be managed in the AI API Configuration tab. Coolify environment
            variables are still supported as a fallback for teams that prefer infrastructure-managed secrets.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Broadcasts Tab
function formatBroadcastRate(value: number | undefined) {
  const rate = Number(value || 0);
  return `${rate >= 10 || Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(1)}%`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sponsorTrackingUrl(link: AdminSponsorLink) {
  if (link.trackingUrl.startsWith('/')) {
    return `${window.location.origin}${link.trackingUrl}`;
  }
  return link.trackingUrl;
}

function sponsorMessageSnippet(link: AdminSponsorLink) {
  const trackingUrl = sponsorTrackingUrl(link);
  const sponsorLine = link.sponsorName
    ? `<p style="margin:4px 0 0;color:#475569;font-size:13px;">From ${escapeHtml(link.sponsorName)}</p>`
    : '';
  return [
    '<div style="border:1px solid #bae6fd;background:#f0fdfa;border-radius:12px;padding:14px;margin:16px 0;">',
    `<p style="margin:0 0 6px;color:#0f766e;font-size:12px;font-weight:800;text-transform:uppercase;">${escapeHtml(link.disclosureLabel || 'Sponsored Resource')}</p>`,
    `<p style="margin:0;color:#0f172a;font-size:16px;font-weight:800;">${escapeHtml(link.title)}</p>`,
    sponsorLine,
    `<p style="margin:12px 0 0;"><a href="${escapeHtml(trackingUrl)}" target="_blank" rel="noopener noreferrer" style="color:#0369a1;font-weight:800;">Open resource</a></p>`,
    '</div>',
  ].filter(Boolean).join('');
}

function normalizeEmbedUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (!['https:', 'http:'].includes(parsed.protocol)) return '';

    if (parsed.hostname === 'youtu.be') {
      const videoId = parsed.pathname.split('/').filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` : '';
    }

    if (parsed.hostname.includes('youtube.com') && parsed.pathname === '/watch') {
      const videoId = parsed.searchParams.get('v');
      return videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` : '';
    }

    if (parsed.hostname.includes('vimeo.com')) {
      const videoId = parsed.pathname.split('/').filter(Boolean)[0];
      if (videoId && /^\d+$/.test(videoId)) {
        return `https://player.vimeo.com/video/${videoId}`;
      }
    }

    return parsed.href;
  } catch {
    return '';
  }
}

function sponsorEmbedSnippet(url: string, title: string) {
  const embedUrl = normalizeEmbedUrl(url);
  if (!embedUrl) return '';
  const parsed = new URL(embedUrl);
  const embedTitle = title.trim() || `Embedded resource from ${parsed.hostname.replace(/^www\./, '')}`;
  return [
    '<p><strong>Sponsored Resource</strong></p>',
    `<iframe src="${escapeHtml(embedUrl)}" title="${escapeHtml(embedTitle)}" width="100%" height="315" loading="lazy" allow="fullscreen; encrypted-media; picture-in-picture; web-share"></iframe>`,
  ].join('\n');
}

function BroadcastsTab() {
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [sponsorLinks, setSponsorLinks] = useState<AdminSponsorLink[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSponsorLinks, setIsLoadingSponsorLinks] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSponsorLink, setIsSavingSponsorLink] = useState(false);
  const [isExportingBroadcasts, setIsExportingBroadcasts] = useState(false);
  const [isExportingSponsorLinks, setIsExportingSponsorLinks] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [sponsorLinkError, setSponsorLinkError] = useState<string | null>(null);
  const [copiedSponsorLinkId, setCopiedSponsorLinkId] = useState<string | null>(null);
  const [newBroadcast, setNewBroadcast] = useState({
    title: '',
    message: '',
    audienceType: 'all_users' as BroadcastAudience,
    scheduledAt: '',
    sendEmail: true,
  });
  const [newSponsorLink, setNewSponsorLink] = useState({
    title: '',
    sponsorName: '',
    destinationUrl: '',
    disclosureLabel: 'Sponsored Resource',
    notes: '',
  });
  const [newSponsorEmbed, setNewSponsorEmbed] = useState({
    url: '',
    title: '',
  });

  const loadBroadcasts = async () => {
    setIsLoading(true);
    setBroadcastError(null);
    const result = await getBroadcastMessages();
    if (result.success && result.data) {
      setBroadcasts(result.data);
    } else {
      setBroadcastError(result.error || 'Unable to load broadcasts');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void loadBroadcasts();
    void loadSponsorLinks();
  }, []);

  const loadSponsorLinks = async () => {
    setIsLoadingSponsorLinks(true);
    setSponsorLinkError(null);
    try {
      setSponsorLinks(await fetchAdminSponsorLinks());
    } catch (err) {
      setSponsorLinkError(err instanceof Error ? err.message : 'Unable to load sponsor links');
    } finally {
      setIsLoadingSponsorLinks(false);
    }
  };

  const handleDownloadBroadcastReport = async () => {
    setIsExportingBroadcasts(true);
    setBroadcastError(null);
    try {
      await downloadAdminCsv('/api/admin/reports/broadcasts.csv', 'spouse-interview-broadcast-performance.csv');
    } catch (err) {
      setBroadcastError(err instanceof Error ? err.message : 'Unable to download broadcast report');
    } finally {
      setIsExportingBroadcasts(false);
    }
  };

  const handleDownloadSponsorLinkReport = async () => {
    setIsExportingSponsorLinks(true);
    setSponsorLinkError(null);
    try {
      await downloadAdminCsv('/api/admin/reports/sponsor-links.csv', 'spouse-interview-sponsor-links.csv');
    } catch (err) {
      setSponsorLinkError(err instanceof Error ? err.message : 'Unable to download sponsor link report');
    } finally {
      setIsExportingSponsorLinks(false);
    }
  };

  const handleAddSponsorLink = async () => {
    if (!newSponsorLink.title.trim() || !newSponsorLink.destinationUrl.trim()) return;
    setIsSavingSponsorLink(true);
    setSponsorLinkError(null);
    try {
      const created = await createAdminSponsorLink(newSponsorLink);
      setSponsorLinks(prev => [created, ...prev]);
      setNewSponsorLink({
        title: '',
        sponsorName: '',
        destinationUrl: '',
        disclosureLabel: 'Sponsored Resource',
        notes: '',
      });
    } catch (err) {
      setSponsorLinkError(err instanceof Error ? err.message : 'Unable to create sponsor link');
    } finally {
      setIsSavingSponsorLink(false);
    }
  };

  const handleToggleSponsorLink = async (link: AdminSponsorLink) => {
    setSponsorLinks(prev => prev.map(item => item.id === link.id ? { ...item, isActive: !link.isActive } : item));
    try {
      const updated = await updateAdminSponsorLink(link.id, { isActive: !link.isActive });
      setSponsorLinks(prev => prev.map(item => item.id === updated.id ? updated : item));
    } catch (err) {
      setSponsorLinkError(err instanceof Error ? err.message : 'Unable to update sponsor link');
      void loadSponsorLinks();
    }
  };

  const handleCopySponsorLink = async (link: AdminSponsorLink) => {
    const trackingUrl = sponsorTrackingUrl(link);
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopiedSponsorLinkId(link.id);
      window.setTimeout(() => setCopiedSponsorLinkId(null), 1800);
    } catch {
      setSponsorLinkError('Unable to copy link. You can select and copy it manually.');
    }
  };

  const handleInsertSponsorLink = (link: AdminSponsorLink) => {
    const snippet = sponsorMessageSnippet(link);
    setNewBroadcast(prev => ({
      ...prev,
      message: prev.message.trim()
        ? `${prev.message.trim()}\n\n${snippet}`
        : snippet,
    }));
    setShowAddForm(true);
  };

  const handleInsertSponsorEmbed = () => {
    const snippet = sponsorEmbedSnippet(newSponsorEmbed.url, newSponsorEmbed.title);
    if (!snippet) {
      setBroadcastError('Enter a valid http or https embed URL.');
      return;
    }
    setBroadcastError(null);
    setNewBroadcast(prev => ({
      ...prev,
      message: prev.message.trim()
        ? `${prev.message.trim()}\n\n${snippet}`
        : snippet,
    }));
    setNewSponsorEmbed({ url: '', title: '' });
    setShowAddForm(true);
  };

  const handleDuplicateBroadcast = (broadcast: BroadcastMessage) => {
    const duplicateTitle = broadcast.title.startsWith('Copy of ')
      ? broadcast.title
      : `Copy of ${broadcast.title}`;
    setNewBroadcast({
      title: duplicateTitle.slice(0, 180),
      message: broadcast.message,
      audienceType: broadcast.audienceType,
      scheduledAt: '',
      sendEmail: broadcast.sendEmail ?? true,
    });
    setBroadcastError(null);
    setShowAddForm(true);
  };

  const scheduleDate = newBroadcast.scheduledAt ? newBroadcast.scheduledAt.slice(0, 10) : '';
  const scheduleTime = newBroadcast.scheduledAt ? newBroadcast.scheduledAt.slice(11, 16) : '';
  const updateSchedulePart = (part: 'date' | 'time', value: string) => {
    const nextDate = part === 'date' ? value : scheduleDate;
    const nextTime = part === 'time' ? value : scheduleTime;
    setNewBroadcast(prev => ({
      ...prev,
      scheduledAt: nextDate ? `${nextDate}T${nextTime || '09:00'}` : '',
    }));
  };

  const handleToggleActive = async (broadcast: BroadcastMessage) => {
    setBroadcasts(prev => prev.map(b =>
      b.id === broadcast.id ? { ...b, isActive: !b.isActive } : b
    ));
    const result = await toggleBroadcastStatus(broadcast.id, !broadcast.isActive);
    if (!result.success) {
      setBroadcastError(result.error || 'Unable to update broadcast');
      void loadBroadcasts();
    }
  };

  const handleAddBroadcast = async () => {
    if (!newBroadcast.title.trim() || !newBroadcast.message.trim()) return;

    setIsSaving(true);
    setBroadcastError(null);
    const scheduledAt = newBroadcast.scheduledAt ? new Date(newBroadcast.scheduledAt).toISOString() : null;
    const publishNow = !scheduledAt || new Date(scheduledAt).getTime() <= Date.now();
    const result = await createBroadcast({
      title: newBroadcast.title,
      message: newBroadcast.message,
      audienceType: newBroadcast.audienceType,
      scheduledAt,
      sendEmail: newBroadcast.sendEmail,
      publishNow,
    });

    if (result.success && result.data) {
      setBroadcasts(prev => [result.data!, ...prev.filter(broadcast => broadcast.id !== result.data!.id)]);
      setNewBroadcast({ title: '', message: '', audienceType: 'all_users', scheduledAt: '', sendEmail: true });
      setShowAddForm(false);
    } else {
      setBroadcastError(result.error || 'Unable to create broadcast');
    }
    setIsSaving(false);
  };

  const handlePublish = async (broadcastId: string) => {
    setBroadcastError(null);
    const result = await publishBroadcast(broadcastId);
    if (!result.success) {
      setBroadcastError(result.error || 'Unable to publish broadcast');
      return;
    }
    void loadBroadcasts();
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-white via-blue-50/80 to-emerald-50/70 shadow-xl shadow-blue-100/60">
        <CardHeader className="border-b border-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Broadcast Messages</CardTitle>
              <CardDescription>Send rich HTML, links, linked images, and safe embeds to free-app audiences.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadBroadcastReport} disabled={isExportingBroadcasts}>
                {isExportingBroadcasts ? <RefreshCw className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                Export CSV
              </Button>
              <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-gradient-to-r from-blue-700 to-cyan-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                New Broadcast
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {broadcastError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
              {broadcastError}
            </div>
          )}
          {showAddForm && (
            <div className="mb-6 space-y-4 rounded-2xl border-2 border-cyan-200 bg-white p-4 shadow-sm">
              <h4 className="font-extrabold text-slate-950">Create New Broadcast</h4>
              <div className="space-y-2">
                <Label className="font-bold text-slate-900">Title</Label>
                <Input
                  placeholder="e.g., New Feature Announcement"
                  value={newBroadcast.title}
                  onChange={(e) => setNewBroadcast(prev => ({ ...prev, title: e.target.value }))}
                  className="border-slate-300 bg-white font-semibold text-slate-950"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-slate-900">Message HTML or plain text</Label>
                <textarea
                  className="min-h-[150px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={'Use plain text or HTML, e.g. <p>New guide is live</p><a href="https://...">Open it</a><img src="https://..." alt="Preview">'}
                  value={newBroadcast.message}
                  onChange={(e) => setNewBroadcast(prev => ({ ...prev, message: e.target.value }))}
                />
                <p className="text-xs font-semibold text-slate-600">
                  Allowed in user inbox: links, basic formatting, lists, quotes, code blocks, linked images, and sandboxed http/https iframes.
                </p>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-blue-800">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Sponsored embed
                  </div>
                  <div className="grid gap-2 lg:grid-cols-[1.2fr_1fr_auto]">
                    <Input
                      placeholder="https://youtube.com/watch?v=... or sponsor embed URL"
                      value={newSponsorEmbed.url}
                      onChange={(event) => setNewSponsorEmbed(prev => ({ ...prev, url: event.target.value }))}
                      className="bg-white font-semibold text-slate-950"
                    />
                    <Input
                      placeholder="Embed title"
                      value={newSponsorEmbed.title}
                      onChange={(event) => setNewSponsorEmbed(prev => ({ ...prev, title: event.target.value }))}
                      className="bg-white font-semibold text-slate-950"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleInsertSponsorEmbed}
                      disabled={!newSponsorEmbed.url.trim()}
                      className="border-blue-200 bg-white text-blue-800 hover:bg-blue-100"
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Insert Embed
                    </Button>
                  </div>
                </div>
                {sponsorLinks.some(link => link.isActive) && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-emerald-800">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Tracked sponsor CTAs
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sponsorLinks.filter(link => link.isActive).slice(0, 8).map((link) => (
                        <Button
                          key={link.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleInsertSponsorLink(link)}
                          className="border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-100"
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          {link.title}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-900">Target Audience</Label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950"
                    value={newBroadcast.audienceType}
                    onChange={(e) => setNewBroadcast(prev => ({ ...prev, audienceType: e.target.value as BroadcastAudience }))}
                  >
                    <option value="all_users">All Users</option>
                    <option value="free_users">Free Members</option>
                    <option value="trial_users">Trial Users</option>
                    <option value="premium_users">Pro / Paid Members</option>
                    <option value="expired_users">Expired Subscriptions</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-900">Schedule</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => updateSchedulePart('date', e.target.value)}
                      className="border-slate-300 bg-white font-semibold text-slate-950"
                    />
                    <Input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => updateSchedulePart('time', e.target.value)}
                      className="border-slate-300 bg-white font-semibold text-slate-950"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <div>
                    <Label className="font-bold text-slate-900">Email users too</Label>
                    <p className="text-xs font-semibold text-slate-600">Sends a personal email alert.</p>
                  </div>
                  <Switch
                    checked={newBroadcast.sendEmail}
                    onCheckedChange={(checked) => setNewBroadcast(prev => ({ ...prev, sendEmail: checked }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddBroadcast} disabled={isSaving} className="bg-gradient-to-r from-blue-700 to-cyan-700 text-white">
                  {isSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
                  {newBroadcast.scheduledAt ? 'Schedule Broadcast' : 'Send Broadcast'}
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="mb-6 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h4 className="font-extrabold text-slate-950">Sponsor Link Tracker</h4>
              <p className="text-sm font-semibold text-slate-600">
                Create tracked affiliate or sponsor URLs to paste into broadcasts, welcome messages, or sponsored resources.
              </p>
            </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadSponsorLinkReport} disabled={isExportingSponsorLinks}>
                  {isExportingSponsorLinks ? <RefreshCw className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                  Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={loadSponsorLinks} disabled={isLoadingSponsorLinks}>
                  <RefreshCw className={cn('mr-1 h-4 w-4', isLoadingSponsorLinks && 'animate-spin')} />
                  Refresh Links
                </Button>
              </div>
            </div>

            {sponsorLinkError && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                {sponsorLinkError}
              </div>
            )}

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
              <Input
                placeholder="Resource title"
                value={newSponsorLink.title}
                onChange={(event) => setNewSponsorLink(prev => ({ ...prev, title: event.target.value }))}
                className="bg-white font-semibold text-slate-950"
              />
              <Input
                placeholder="Sponsor name"
                value={newSponsorLink.sponsorName}
                onChange={(event) => setNewSponsorLink(prev => ({ ...prev, sponsorName: event.target.value }))}
                className="bg-white font-semibold text-slate-950"
              />
              <Input
                placeholder="https://affiliate-or-sponsor-url.com"
                value={newSponsorLink.destinationUrl}
                onChange={(event) => setNewSponsorLink(prev => ({ ...prev, destinationUrl: event.target.value }))}
                className="bg-white font-semibold text-slate-950"
              />
              <Button
                onClick={handleAddSponsorLink}
                disabled={isSavingSponsorLink || !newSponsorLink.title.trim() || !newSponsorLink.destinationUrl.trim()}
                className="bg-gradient-to-r from-emerald-700 to-cyan-700 text-white"
              >
                {isSavingSponsorLink ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add Link
              </Button>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_2fr]">
              <Input
                placeholder="Disclosure label"
                value={newSponsorLink.disclosureLabel}
                onChange={(event) => setNewSponsorLink(prev => ({ ...prev, disclosureLabel: event.target.value }))}
                className="bg-white font-semibold text-slate-950"
              />
              <Input
                placeholder="Internal notes, placement idea, or campaign details"
                value={newSponsorLink.notes}
                onChange={(event) => setNewSponsorLink(prev => ({ ...prev, notes: event.target.value }))}
                className="bg-white font-semibold text-slate-950"
              />
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-emerald-100 bg-white">
              {isLoadingSponsorLinks ? (
                <div className="flex items-center justify-center gap-2 p-5 text-sm font-semibold text-slate-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading sponsor links...
                </div>
              ) : sponsorLinks.length === 0 ? (
                <div className="p-5 text-center text-sm font-semibold text-slate-600">
                  No tracked sponsor links yet.
                </div>
              ) : (
                <div className="divide-y divide-emerald-100">
                  {sponsorLinks.map((link) => {
                    const trackingUrl = sponsorTrackingUrl(link);
                    return (
                      <div key={link.id} className="grid gap-3 p-3 lg:grid-cols-[1fr_auto] lg:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-extrabold text-slate-950">{link.title}</p>
                            <Badge variant={link.isActive ? 'default' : 'secondary'}>{link.isActive ? 'Active' : 'Paused'}</Badge>
                            {link.sponsorName && <Badge variant="outline">{link.sponsorName}</Badge>}
                          </div>
                          <p className="mt-1 break-all text-xs font-semibold text-slate-500">{trackingUrl}</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                            <span>{link.clickCount.toLocaleString()} clicks</span>
                            <span>{link.uniqueUsers.toLocaleString()} signed-in users</span>
                            <span>Last click: {link.lastClickAt ? new Date(link.lastClickAt).toLocaleString() : 'none yet'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleInsertSponsorLink(link)}
                            disabled={!link.isActive}
                          >
                            <Plus className="mr-1 h-4 w-4" />
                            Insert CTA
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleCopySponsorLink(link)}>
                            {copiedSponsorLinkId === link.id ? <CheckCircle className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                            {copiedSponsorLinkId === link.id ? 'Copied' : 'Copy'}
                          </Button>
                          <Switch
                            checked={link.isActive}
                            onCheckedChange={() => handleToggleSponsorLink(link)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm font-semibold text-slate-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading broadcasts...
              </div>
            ) : broadcasts.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Megaphone className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">No broadcasts yet</p>
                <p className="text-sm">Click "New Broadcast" to create your first announcement.</p>
              </div>
            ) : (
              <div className="divide-y">
                {broadcasts.map((broadcast) => {
                  const delivered = broadcast.analytics?.delivered ?? broadcast.sentCount;
                  const opened = broadcast.analytics?.opened ?? 0;
                  const clicked = broadcast.analytics?.clicked ?? 0;
                  const openRate = broadcast.analytics?.openRate ?? (delivered ? (opened / delivered) * 100 : 0);
                  const clickRate = broadcast.analytics?.clickRate ?? (delivered ? (clicked / delivered) * 100 : 0);
                  return (
                  <div key={broadcast.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-slate-950">{broadcast.title}</h4>
                        <Badge variant={broadcast.isActive ? 'default' : 'secondary'}>
                          {broadcast.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {broadcast.sendEmail && (
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                            Email on
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <RichMessageContent content={broadcast.message} />
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        <span>Audience: {BROADCAST_AUDIENCE_LABELS[broadcast.audienceType]}</span>
                        <span>Sent to: {broadcast.sentCount.toLocaleString()} users</span>
                        <span>Created: {new Date(broadcast.createdAt).toLocaleDateString()}</span>
                        {broadcast.scheduledAt && <span>Scheduled: {new Date(broadcast.scheduledAt).toLocaleString()}</span>}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <p className="font-semibold text-slate-500">Delivered</p>
                          <p className="mt-1 text-base font-extrabold text-slate-950">{delivered.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                          <p className="font-semibold text-blue-700">Opened</p>
                          <p className="mt-1 text-base font-extrabold text-slate-950">
                            {opened.toLocaleString()} <span className="text-xs text-blue-700">({formatBroadcastRate(openRate)})</span>
                          </p>
                        </div>
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                          <p className="font-semibold text-emerald-700">Clicked</p>
                          <p className="mt-1 text-base font-extrabold text-slate-950">
                            {clicked.toLocaleString()} <span className="text-xs text-emerald-700">({formatBroadcastRate(clickRate)})</span>
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="font-semibold text-slate-500">Dismissed</p>
                          <p className="mt-1 text-base font-extrabold text-slate-950">{(broadcast.analytics?.dismissed ?? 0).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleDuplicateBroadcast(broadcast)}>
                        <Copy className="mr-1 h-4 w-4" />
                        Duplicate
                      </Button>
                      {broadcast.sentCount === 0 && (
                        <Button variant="outline" size="sm" onClick={() => handlePublish(broadcast.id)}>
                          Send now
                        </Button>
                      )}
                      <Switch
                        checked={broadcast.isActive}
                        onCheckedChange={() => handleToggleActive(broadcast)}
                      />
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LiveSupportTicketsTab({
  userFilter,
  onClearUserFilter,
}: {
  userFilter?: string | null;
  onClearUserFilter?: () => void;
}) {
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<AdminSupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [autoOpenedFilter, setAutoOpenedFilter] = useState<string | null>(null);

  const loadTickets = async () => {
    setIsLoading(true);
    setError(null);
    const result = await getOpenTicketsForAdmin();
    if (result.success && result.data) {
      setTickets(result.data);
    } else {
      setError(result.error || 'Unable to load support tickets');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const statusColors: Record<string, string> = {
    open: 'bg-amber-100 text-amber-700 border-amber-200',
    replied: 'bg-blue-100 text-blue-700 border-blue-200',
    closed: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const categoryLabels: Record<string, string> = {
    billing: 'Billing',
    refund: 'Refund',
    technical: 'Technical',
    account: 'Account',
    feature_request: 'Feature Request',
    other: 'Other',
  };

  const openReplyDialog = (ticket: AdminSupportTicket) => {
    setSelectedTicket(ticket);
    setReplyText(ticket.aiSuggestedReply || ticket.adminReply || '');
  };

  const visibleTickets = userFilter
    ? tickets.filter(ticket => ticket.userEmail.toLowerCase() === userFilter.toLowerCase())
    : tickets;

  useEffect(() => {
    if (!userFilter || isLoading || autoOpenedFilter === userFilter) return;
    const firstMatchingTicket = visibleTickets[0];
    if (firstMatchingTicket) {
      openReplyDialog(firstMatchingTicket);
      setAutoOpenedFilter(userFilter);
    }
  }, [autoOpenedFilter, isLoading, userFilter, visibleTickets]);

  const handleDraft = async () => {
    if (!selectedTicket) return;
    setIsDrafting(true);
    const result = await draftSupportTicketReply(selectedTicket.id);
    if (result.success && result.data) {
      setReplyText(result.data.reply);
      setSelectedTicket(prev => prev ? {
        ...prev,
        aiSummary: result.data?.summary || prev.aiSummary,
        aiSuggestedReply: result.data?.reply || prev.aiSuggestedReply,
        aiTriage: {
          ...(prev.aiTriage || {}),
          adminDraft: {
            provider: result.data?.provider,
            model: result.data?.model,
            urgency: result.data?.urgency,
            retentionOfferRecommended: result.data?.retentionOfferRecommended,
          },
        },
      } : prev);
    } else {
      setError(result.error || 'Unable to draft a reply');
    }
    setIsDrafting(false);
  };

  const handleReply = async (ticketId: string) => {
    if (!replyText.trim()) return;
    setIsReplying(true);
    const result = await replyToTicket(ticketId, replyText.trim());
    if (result.success) {
      await loadTickets();
      setReplyText('');
      setSelectedTicket(null);
    } else {
      setError(result.error || 'Unable to send reply');
    }
    setIsReplying(false);
  };

  const handleClose = async (ticketId: string) => {
    const result = await closeTicket(ticketId);
    if (result.success) {
      await loadTickets();
      setSelectedTicket(null);
    } else {
      setError(result.error || 'Unable to close ticket');
    }
  };

  const openCount = visibleTickets.filter(t => t.status === 'open').length;
  const repliedCount = visibleTickets.filter(t => t.status === 'replied').length;
  const refundSignalCount = visibleTickets.filter(t => t.refundSignal).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Open Tickets" value={openCount.toString()} change="" trend="up" icon={MessageSquare} />
        <StatCard title="Awaiting Reply" value={repliedCount.toString()} change="" trend="up" icon={Activity} />
        <StatCard title="Refund Signals" value={refundSignalCount.toString()} change="" trend="up" icon={AlertCircle} />
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Legacy Contact Workflow</CardTitle>
              <CardDescription>
                {userFilter
                  ? `Filtered to support messages from ${userFilter}.`
                  : 'Live support requests, AI summaries, refund signals, and retention offers.'}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {userFilter && (
                <Button variant="ghost" size="sm" onClick={onClearUserFilter}>
                  Clear user filter
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={loadTickets}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-500">
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Loading tickets...
              </div>
            ) : visibleTickets.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">No support tickets</p>
                <p className="text-sm">{userFilter ? 'No tickets found for this user.' : 'All caught up!'}</p>
              </div>
            ) : (
              <div className="divide-y">
                {visibleTickets.map((ticket) => (
                  <div key={ticket.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-slate-800">{ticket.subject}</h4>
                        <Badge variant="outline" className={statusColors[ticket.status]}>
                          {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                        </Badge>
                        {ticket.refundSignal && (
                          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                            Refund review
                          </Badge>
                        )}
                        {ticket.adminUrgent && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            Urgent
                          </Badge>
                        )}
                        {ticket.retentionOffer?.eligible && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            Save offer
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-1 line-clamp-2">{ticket.message}</p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400">
                        <span>From: {ticket.userEmail}</span>
                        <span>Category: {categoryLabels[ticket.category]}</span>
                        <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                      </div>
                      {ticket.aiSummary && (
                        <p className="mt-2 text-xs text-slate-500 line-clamp-1">AI summary: {ticket.aiSummary}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => openReplyDialog(ticket)}>
                        {ticket.status === 'open' ? 'Reply' : 'View'}
                      </Button>
                      {ticket.status !== 'closed' && (
                        <Button variant="ghost" size="sm" onClick={() => handleClose(ticket.id)}>
                          Close
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>{selectedTicket.subject}</CardTitle>
              <CardDescription>
                {selectedTicket.userEmail} - {categoryLabels[selectedTicket.category]} - {selectedTicket.status}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedTicket.message}</p>
              </div>
              {(selectedTicket.refundSignal || selectedTicket.retentionOffer?.eligible) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                    <p className="font-medium">Refund signal</p>
                    <p className="mt-1">{selectedTicket.refundEligibility?.status || 'review'} - {selectedTicket.refundEligibility?.note || 'Manual review recommended.'}</p>
                    <p className="mt-1 text-xs">
                      {selectedTicket.usage?.questionsCompleted || 0} questions, {selectedTicket.usage?.totalPdfDownloads || 0} PDF downloads
                    </p>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                    <p className="font-medium">Retention option</p>
                    <p className="mt-1">
                      {selectedTicket.retentionOffer?.eligible
                        ? `${selectedTicket.retentionOffer.label} at $${selectedTicket.retentionOffer.amount.toFixed(2)}`
                        : 'No lower-cost offer recommended for this plan.'}
                    </p>
                    <p className="mt-1 text-xs">{selectedTicket.subscription?.planLabel || 'Plan unknown'} - {selectedTicket.subscription?.status || 'unknown'}</p>
                  </div>
                </div>
              )}
              {selectedTicket.aiSummary && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <p className="text-xs text-blue-600 font-medium mb-1">AI Summary</p>
                  <p className="text-sm text-slate-700">{selectedTicket.aiSummary}</p>
                </div>
              )}
              {selectedTicket.adminReply && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium mb-1">Previous Reply:</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedTicket.adminReply}</p>
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Your Reply</Label>
                  <Button variant="outline" size="sm" onClick={handleDraft} disabled={isDrafting}>
                    {isDrafting ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    AI Draft
                  </Button>
                </div>
                <textarea
                  className="w-full min-h-[130px] px-3 py-2 rounded-md border border-slate-200 text-sm"
                  placeholder="Type your response..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
              </div>
            </CardContent>
            <CardContent className="flex justify-end gap-2 pt-0">
              <Button variant="outline" onClick={() => setSelectedTicket(null)}>
                Cancel
              </Button>
              <Button onClick={() => handleReply(selectedTicket.id)} disabled={isReplying || !replyText.trim()} className="bg-slate-700 hover:bg-slate-800">
                {isReplying && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                Send Reply
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Legacy contact workflow fallback
function SupportTicketsTab({
  userFilter,
  onClearUserFilter,
}: {
  userFilter?: string | null;
  onClearUserFilter?: () => void;
}) {
  return <LiveSupportTicketsTab userFilter={userFilter} onClearUserFilter={onClearUserFilter} />;
}

const RETIRED_ADMIN_WORKFLOWS_FOR_COMPATIBILITY = [BillingTab, PromoCodesTab, SupportTicketsTab];
void RETIRED_ADMIN_WORKFLOWS_FOR_COMPATIBILITY;

function LiveAnswerExamplesTab() {
  const [candidates, setCandidates] = useState<AdminCandidateView[]>([]);
  const [stats, setStats] = useState<CandidateStats>({
    totalCandidates: 0,
    pendingReview: 0,
    approvedCount: 0,
    rejectedCount: 0,
    needsEditCount: 0,
    todayCount: 0,
  });
  const [selectedCandidate, setSelectedCandidate] = useState<AdminCandidateView | null>(null);
  const [candidateDetails, setCandidateDetails] = useState<{ originalAnswer: string; qualityReason?: string | null } | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
    needs_edit: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  const qualityColors: Record<string, string> = {
    too_short: 'bg-slate-100 text-slate-600',
    usable_example: 'bg-blue-100 text-blue-700',
    needs_cleanup: 'bg-amber-100 text-amber-700',
    strong_story_structure: 'bg-emerald-100 text-emerald-700',
    uncategorized: 'bg-slate-100 text-slate-600',
  };

  const loadCandidates = async () => {
    setIsLoading(true);
    setError(null);
    const [candidateResult, statsResult] = await Promise.all([
      getPendingCandidates(100, 0),
      getCandidateStats(),
    ]);
    if (candidateResult.success && candidateResult.data) {
      setCandidates(candidateResult.data);
    } else {
      setError(candidateResult.error || 'Unable to load answer candidates');
    }
    if (statsResult.success && statsResult.data) {
      setStats(statsResult.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadCandidates();
  }, []);

  const openCandidate = async (candidate: AdminCandidateView) => {
    setSelectedCandidate(candidate);
    setReviewerNotes('');
    setShowOriginal(false);
    setCandidateDetails(null);
    const result = await getCandidateDetails(candidate.id);
    if (result.success && result.data) {
      setCandidateDetails({
        originalAnswer: result.data.originalAnswer,
        qualityReason: result.data.qualityReason,
      });
    }
  };

  const handleReview = async (
    candidateId: string,
    status: 'approved' | 'rejected' | 'needs_edit',
    approvedForPublication = false
  ) => {
    const result = await updateCandidateReview(candidateId, status, reviewerNotes, approvedForPublication);
    if (result.success) {
      setSelectedCandidate(null);
      await loadCandidates();
    } else {
      setError(result.error || 'Unable to update candidate review');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Candidates" value={stats.totalCandidates.toString()} change="" trend="up" icon={FileText} />
        <StatCard title="Pending Review" value={(stats.pendingReview || candidates.length).toString()} change="" trend="up" icon={AlertCircle} />
        <StatCard title="Approved" value={stats.approvedCount.toString()} change="" trend="up" icon={CheckCircle} />
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Answer Example Candidates</CardTitle>
              <CardDescription>Sanitized answers captured from Robin practice for manual memory-bank review.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadCandidates}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-500">
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Loading answer candidates...
              </div>
            ) : candidates.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">No pending answer candidates</p>
                <p className="text-sm">Captured answers will appear here after Robin interview practice.</p>
              </div>
            ) : (
              <div className="divide-y">
                {candidates.map((candidate) => (
                  <div key={candidate.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-slate-800">{candidate.questionPrompt}</h4>
                        <Badge variant="outline" className={statusColors[candidate.reviewStatus]}>
                          {candidate.reviewStatus.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className={qualityColors[candidate.qualityScore] || qualityColors.uncategorized}>
                          {candidate.qualityScore.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 mt-2 line-clamp-2">{candidate.sanitizedAnswer}</p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400">
                        <span>Pattern: {candidate.answerPattern}</span>
                        <span>From: {candidate.userEmail || 'Unknown user'}</span>
                        <span>{new Date(candidate.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openCandidate(candidate)}>
                      Review
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Review Answer Candidate</CardTitle>
              <CardDescription>{selectedCandidate.questionPrompt}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={statusColors[selectedCandidate.reviewStatus]}>
                  Status: {selectedCandidate.reviewStatus}
                </Badge>
                <Badge variant="outline" className={qualityColors[selectedCandidate.qualityScore] || qualityColors.uncategorized}>
                  Quality: {selectedCandidate.qualityScore}
                </Badge>
                <Badge variant="outline">Pattern: {selectedCandidate.answerPattern}</Badge>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs font-medium text-slate-500 mb-2">SANITIZED ANSWER</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedCandidate.sanitizedAnswer}</p>
                {candidateDetails?.qualityReason && (
                  <p className="mt-3 text-xs text-slate-500">{candidateDetails.qualityReason}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch id="show-original-live" checked={showOriginal} onCheckedChange={setShowOriginal} />
                <Label htmlFor="show-original-live" className="text-sm text-slate-600">Show original answer (private)</Label>
              </div>

              {showOriginal && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                  <p className="text-xs font-medium text-amber-700 mb-2">ORIGINAL ANSWER - ADMIN ONLY</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {candidateDetails?.originalAnswer || 'Original answer is loading or unavailable.'}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Reviewer Notes</Label>
                <textarea
                  className="w-full min-h-[80px] px-3 py-2 rounded-md border border-slate-200 text-sm"
                  placeholder="Add notes about this candidate..."
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                />
              </div>
            </CardContent>
            <CardContent className="flex justify-end gap-2 pt-0">
              <Button variant="outline" onClick={() => setSelectedCandidate(null)}>
                Cancel
              </Button>
              <Button variant="outline" onClick={() => handleReview(selectedCandidate.id, 'needs_edit')} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                <AlertCircle className="w-4 h-4 mr-2" />
                Needs Edit
              </Button>
              <Button variant="outline" onClick={() => handleReview(selectedCandidate.id, 'rejected')} className="text-red-600 border-red-200 hover:bg-red-50">
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button onClick={() => handleReview(selectedCandidate.id, 'approved', true)} className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve for Bank
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Answer Examples Tab
function AnswerExamplesTab() {
  return <LiveAnswerExamplesTab />;
}

// Helper Components
function StatCard({ title, value, change, trend, icon: Icon, onClick }: {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: typeof Users;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(onClick && 'cursor-pointer transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg')}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="p-2 bg-slate-100 rounded-lg">
            <Icon className="w-5 h-5 text-slate-600" />
          </div>
          {change && (
            <Badge variant={trend === 'up' ? 'default' : 'destructive'} className="text-xs">
              {change}
            </Badge>
          )}
        </div>
        <div className="mt-4">
          <div className="text-2xl font-medium text-slate-800">{value}</div>
          <div className="text-sm text-slate-500">{title}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthItem({ name, status, message }: {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  message?: string;
}) {
  const statusColors = {
    healthy: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={cn('w-2 h-2 rounded-full', statusColors[status])} />
        <span className="text-slate-700">{name}</span>
      </div>
      <div className="text-right">
        {message ? (
          <span className="text-sm text-amber-600">{message}</span>
        ) : (
          <span className="text-sm text-emerald-600">Operational</span>
        )}
      </div>
    </div>
  );
}
