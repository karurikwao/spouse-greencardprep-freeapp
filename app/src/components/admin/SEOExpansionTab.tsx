/**
 * SEO Expansion Settings Tab
 * 
 * Admin interface for controlling future SEO expansion features.
 * All features are DISABLED by default for safety.
 * 
 * IMPORTANT GUIDANCE FOR ADMINS:
 * - Do NOT enable pattern/situation pages on a brand-new domain
 * - Recommended activation: 3-6 months after site launch
 * - Only enable after the site has been indexed and aged
 * - These features are for later SEO expansion only
 * 
 * PERSISTENCE: All changes are saved to Supabase and are immediately authoritative
 * across all sessions and devices.
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Globe, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  FileText,
  Users,
  Info,
  Lock,
  Map,
  EyeOff,
  Calculator,
  Play,
  TrendingUp,
  CheckSquare,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  Target,
  Sparkles,
  History,
  PlayCircle,
  ListTodo,
  AlertCircle,
  RotateCcw,
  Timer,
  Rocket,
  Check,
  // ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  getExpansionStats,
  saveExpansionSettings,
  getExpansionSettings,
  type ExpansionStats,
  PATTERN_PAGES,
  SITUATION_PAGES_CONFIG,
  type PagePublicationState,
  type PublicationStatus,
  type RolloutFrequency,
  type PageCountMode,
  getAllPublicationStates,
  publishPage,
  unpublishPage,
  bulkPublishPages,
  bulkUnpublishPages,
  bulkMarkReviewed,
  bulkMarkApproved,
  getSitemapSyncStatus,
  type SitemapSyncStatus,
  triggerCoolifyRebuild,
  getAllPageRecommendations,
  type PageAIRecommendations,
  getCurrentRolloutPhase,
  shouldShowReminderBanner,
  getDaysSinceLaunch,
  type SEOExpansionSettings,
  previewNextSchedulerCycle,
  executeSchedulerCycle,
  type SchedulerPreviewResult,
  type SchedulerRunResult,
  getSchedulerRunHistory,
  type SchedulerRun,
} from '@/lib/seo/expansion';

// Status badge component
function StatusBadge({ status }: { status: PublicationStatus }) {
  const styles: Record<PublicationStatus, string> = {
    draft: 'bg-slate-100 text-slate-600 border-slate-200',
    reviewed: 'bg-blue-100 text-blue-700 border-blue-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    published: 'bg-green-100 text-green-700 border-green-200',
    unpublished: 'bg-amber-100 text-amber-700 border-amber-200',
  };
  
  const labels: Record<PublicationStatus, string> = {
    draft: 'Draft',
    reviewed: 'Reviewed',
    approved: 'Approved',
    published: 'Published',
    unpublished: 'Unpublished',
  };
  
  return (
    <Badge variant="outline" className={styles[status]}>
      {labels[status]}
    </Badge>
  );
}

// Priority indicator
function PriorityIndicator({ priority }: { priority: number }) {
  let color = 'text-slate-400';
  let bg = 'bg-slate-100';
  
  if (priority >= 80) {
    color = 'text-emerald-600';
    bg = 'bg-emerald-100';
  } else if (priority >= 60) {
    color = 'text-blue-600';
    bg = 'bg-blue-100';
  } else if (priority >= 40) {
    color = 'text-amber-600';
    bg = 'bg-amber-100';
  }
  
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div 
          className={`h-full ${bg.replace('bg-', 'bg-').replace('100', '500')}`} 
          style={{ width: `${priority}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${color}`}>{priority}</span>
    </div>
  );
}

export function SEOExpansionTab() {
  // Core state
  const [stats, setStats] = useState<ExpansionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pageStates, setPageStates] = useState<PagePublicationState[]>([]);
  const [recommendations, setRecommendations] = useState<PageAIRecommendations[]>([]);
  
  // Selection state
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Settings state (all disabled/safe by default)
  const [patternPagesEnabled, setPatternPagesEnabled] = useState(false);
  const [situationPagesEnabled, setSituationPagesEnabled] = useState(false);
  const [recommendedMonths, setRecommendedMonths] = useState<3 | 4 | 6>(3);
  const [includeInSitemap, setIncludeInSitemap] = useState(false);
  const [noindexUntilApproved, setNoindexUntilApproved] = useState(true);
  
  // Scheduler state
  const [schedulerEnabled, setSchedulerEnabled] = useState(false);
  const [schedulerFrequency, setSchedulerFrequency] = useState<RolloutFrequency>('weekly');
  const [pageCountMode, setPageCountMode] = useState<PageCountMode>('fixed');
  const [fixedPageCount, setFixedPageCount] = useState(2);
  const [randomMinPages, setRandomMinPages] = useState(2);
  const [randomMaxPages, setRandomMaxPages] = useState(4);
  const [schedulerOnlyApproved, setSchedulerOnlyApproved] = useState(true);
  const [schedulerAutoSitemap, setSchedulerAutoSitemap] = useState(false);
  
  // Guidance state
  const [launchDate, setLaunchDate] = useState<string>('');
  const [reminderBanner, setReminderBanner] = useState(true);
  const [rolloutPhase, setRolloutPhase] = useState<{phase: 1 | 2 | 3; name: string; description: string; actions: string[]}>({
    phase: 1,
    name: 'Phase 1: Foundation',
    description: 'Launch to Month 3 - Focus on core pages',
    actions: [
      'Keep expansion pages OFF',
      'Keep sitemap inclusion OFF',
      'Keep noindex ON',
      'Focus on indexing core pages first',
    ],
  });
  
  // Scheduler execution state
  const [schedulerPreview, setSchedulerPreview] = useState<SchedulerPreviewResult | null>(null);
  const [isRunningScheduler, setIsRunningScheduler] = useState(false);
  const [runHistory, setRunHistory] = useState<SchedulerRun[]>([]);
  const [showSchedulerPreview, setShowSchedulerPreview] = useState(false);
  const [schedulerResult, setSchedulerResult] = useState<SchedulerRunResult | null>(null);
  
  // UI state
  const [showAIRecommendations, setShowAIRecommendations] = useState(true);
  const [showRunHistory, setShowRunHistory] = useState(true);
  const [daysSinceLaunch, setDaysSinceLaunch] = useState<number | null>(null);
  const [showReminder, setShowReminder] = useState(false);
  
  // Sitemap sync status (with honest estimates)
  const [sitemapStatus, setSitemapStatus] = useState<SitemapSyncStatus | null>(null);
  
  // Coolify rebuild trigger state
  const [isTriggeringDeploy, setIsTriggeringDeploy] = useState(false);
  const [deployMessage, setDeployMessage] = useState<{type: 'success' | 'error'; text: string} | null>(null);
  
  // Track last trigger time to prevent rapid re-clicks (5 minute cooldown)
  const [lastTriggerTime, setLastTriggerTime] = useState<number | null>(null);
  
  // Post-publish checklist
  const [showPostPublishChecklist, setShowPostPublishChecklist] = useState(false);
  const [checklistItems, setChecklistItems] = useState({
    reviewed: false,
    settings: false,
    rebuild: false,
    rechecked: false,
  });
  
  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [
        expansionStats,
        states,
        recs,
        phase,
        days,
        reminder,
        history,
        sitemapSync,
      ] = await Promise.all([
        getExpansionStats(),
        getAllPublicationStates(),
        Promise.resolve(getAllPageRecommendations()),
        getCurrentRolloutPhase(),
        getDaysSinceLaunch(),
        shouldShowReminderBanner(),
        getSchedulerRunHistory(5),
        getSitemapSyncStatus(),
      ]);
      
      setStats(expansionStats);
      setPageStates(states);
      setRecommendations(recs);
      setRolloutPhase(phase);
      setDaysSinceLaunch(days);
      setShowReminder(reminder);
      setRunHistory(history);
      setSitemapStatus(sitemapSync);
      
      // Load settings
      const settings = await getExpansionSettings();
      setPatternPagesEnabled(settings.pattern_pages_enabled);
      setSituationPagesEnabled(settings.situation_pages_enabled);
      setIncludeInSitemap(settings.include_in_sitemap);
      setNoindexUntilApproved(settings.noindex_until_approved);
      setSchedulerEnabled(settings.scheduler.enabled);
      setSchedulerFrequency(settings.scheduler.frequency);
      setPageCountMode(settings.scheduler.page_count_mode);
      setFixedPageCount(settings.scheduler.fixed_page_count);
      setRandomMinPages(settings.scheduler.random_min_pages);
      setRandomMaxPages(settings.scheduler.random_max_pages);
      setSchedulerOnlyApproved(settings.scheduler.only_publish_approved);
      setSchedulerAutoSitemap(settings.scheduler.auto_include_in_sitemap);
      setLaunchDate(settings.guidance.launch_date || '');
      setReminderBanner(settings.guidance.reminder_banner_enabled);
      setRecommendedMonths(settings.recommended_activation_months);
    } catch (err) {
      console.error('Error loading expansion data:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settings: Partial<SEOExpansionSettings> = {
        pattern_pages_enabled: patternPagesEnabled,
        situation_pages_enabled: situationPagesEnabled,
        recommended_activation_months: recommendedMonths,
        include_in_sitemap: includeInSitemap,
        noindex_until_approved: noindexUntilApproved,
        scheduler: {
          enabled: schedulerEnabled,
          frequency: schedulerFrequency,
          page_count_mode: pageCountMode,
          fixed_page_count: fixedPageCount,
          random_min_pages: randomMinPages,
          random_max_pages: randomMaxPages,
          start_date: null,
          only_publish_approved: schedulerOnlyApproved,
          auto_include_in_sitemap: schedulerAutoSitemap,
        },
        guidance: {
          launch_date: launchDate || null,
          recommended_activation_month: recommendedMonths,
          reminder_banner_enabled: reminderBanner,
        },
      };
      
      await saveExpansionSettings(settings);
      await loadData();
    } catch (e) {
      console.error('Error saving expansion settings:', e);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Selection handlers
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedSlugs(new Set());
    } else {
      setSelectedSlugs(new Set(pageStates.map(p => p.slug)));
    }
    setSelectAll(!selectAll);
  };
  
  const handleSelectByStatus = (status: PublicationStatus) => {
    const slugs = pageStates
      .filter(p => p.status === status)
      .map(p => p.slug);
    setSelectedSlugs(new Set(slugs));
    setSelectAll(false);
  };
  
  const handleSelectByType = (type: 'pattern' | 'situation') => {
    const slugs = pageStates
      .filter(p => p.page_type === type)
      .map(p => p.slug);
    setSelectedSlugs(new Set(slugs));
    setSelectAll(false);
  };
  
  const handleSelectRecommended = () => {
    const topRecs = recommendations
      .filter(r => r.recommended_for_early_publish)
      .slice(0, 5)
      .map(r => r.slug);
    setSelectedSlugs(new Set(topRecs));
    setSelectAll(false);
  };
  
  const toggleSelection = (slug: string) => {
    const newSelected = new Set(selectedSlugs);
    if (newSelected.has(slug)) {
      newSelected.delete(slug);
    } else {
      newSelected.add(slug);
    }
    setSelectedSlugs(newSelected);
  };
  
  // Bulk actions
  const handleBulkPublish = async () => {
    const slugs = Array.from(selectedSlugs);
    const { succeeded } = await bulkPublishPages(slugs, includeInSitemap);
    
    setPageStates(prev => prev.map(state => 
      succeeded.includes(state.slug) 
        ? { ...state, status: 'published' as const, is_published: true, is_enabled: true }
        : state
    ));
    setSelectedSlugs(new Set());
    setSelectAll(false);
    await loadData();
  };
  
  const handleBulkUnpublish = async () => {
    const slugs = Array.from(selectedSlugs);
    const { succeeded } = await bulkUnpublishPages(slugs);
    
    setPageStates(prev => prev.map(state => 
      succeeded.includes(state.slug) 
        ? { ...state, status: 'unpublished' as const, is_published: false, is_enabled: false }
        : state
    ));
    setSelectedSlugs(new Set());
    setSelectAll(false);
    await loadData();
  };
  
  const handleBulkMarkReviewed = async () => {
    const slugs = Array.from(selectedSlugs);
    const { succeeded } = await bulkMarkReviewed(slugs);
    
    setPageStates(prev => prev.map(state => 
      succeeded.includes(state.slug) 
        ? { ...state, status: 'reviewed' as const, reviewed_at: new Date().toISOString() }
        : state
    ));
    setSelectedSlugs(new Set());
    await loadData();
  };
  
  const handleBulkMarkApproved = async () => {
    const slugs = Array.from(selectedSlugs);
    const { succeeded } = await bulkMarkApproved(slugs);
    
    setPageStates(prev => prev.map(state => 
      succeeded.includes(state.slug) 
        ? { ...state, status: 'approved' as const, approved_at: new Date().toISOString() }
        : state
    ));
    setSelectedSlugs(new Set());
    await loadData();
  };
  
  // Individual actions
  const handlePublishPage = async (slug: string) => {
    if (await publishPage(slug, includeInSitemap)) {
      setPageStates(prev => prev.map(state => 
        state.slug === slug 
          ? { ...state, status: 'published' as const, is_published: true, is_enabled: true }
          : state
      ));
      await loadData();
    }
  };
  
  const handleUnpublishPage = async (slug: string) => {
    if (await unpublishPage(slug)) {
      setPageStates(prev => prev.map(state => 
        state.slug === slug 
          ? { ...state, status: 'unpublished' as const, is_published: false, is_enabled: false }
          : state
      ));
      await loadData();
    }
  };
  
  // Scheduler execution handlers
  const handlePreviewScheduler = async () => {
    const preview = await previewNextSchedulerCycle();
    setSchedulerPreview(preview);
    setShowSchedulerPreview(true);
  };
  
  const handleRunScheduler = async () => {
    setIsRunningScheduler(true);
    try {
      const result = await executeSchedulerCycle();
      setSchedulerResult(result);
      // Show post-publish checklist if pages were published
      if (result.count > 0) {
        setShowPostPublishChecklist(true);
        // Reset checklist items
        setChecklistItems({
          reviewed: false,
          settings: false,
          rebuild: false,
          rechecked: false,
        });
      }
      await loadData();
    } catch (e) {
      console.error('Error running scheduler:', e);
    } finally {
      setIsRunningScheduler(false);
    }
  };
  
  // Handle Coolify rebuild trigger (secure - via Edge Function)
  const handleTriggerDeploy = async () => {
    // Prevent rapid re-clicks (5 minute cooldown)
    if (lastTriggerTime && Date.now() - lastTriggerTime < 5 * 60 * 1000) {
      const secondsRemaining = Math.ceil((5 * 60 * 1000 - (Date.now() - lastTriggerTime)) / 1000);
      setDeployMessage({
        type: 'error',
        text: `Please wait ${Math.ceil(secondsRemaining / 60)} minutes before triggering another rebuild.`,
      });
      return;
    }
    
    setIsTriggeringDeploy(true);
    setDeployMessage(null);
    
    try {
      const result = await triggerCoolifyRebuild();
      setDeployMessage({
        type: result.success ? 'success' : 'error',
        text: result.message,
      });
      if (result.success) {
        setLastTriggerTime(Date.now());
        await loadData();
        // Mark rebuild as checked in the checklist
        setChecklistItems(prev => ({ ...prev, rebuild: true }));
      }
    } catch {
      setDeployMessage({
        type: 'error',
        text: 'Failed to trigger rebuild. Please try again or contact a developer.',
      });
    } finally {
      setIsTriggeringDeploy(false);
    }
  };
  
  // Combine page states with recommendations
  const pagesWithRecommendations = useMemo(() => {
    const recMap: Record<string, PageAIRecommendations> = {};
    recommendations.forEach(r => { recMap[r.slug] = r; });
    return pageStates.map(state => ({
      ...state,
      recommendation: recMap[state.slug],
    }));
  }, [pageStates, recommendations]);
  
  const anyFeatureEnabled = patternPagesEnabled || situationPagesEnabled;
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-slate-500">Loading expansion settings...</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Globe className="w-6 h-6 text-slate-600" />
        <div>
          <h2 className="text-xl font-medium text-slate-800">SEO Expansion Settings</h2>
          <p className="text-sm text-slate-500">
            Admin-controlled publishing workflow for future SEO expansion pages
          </p>
        </div>
      </div>
      
      {/* Critical Warning Banner */}
      <Alert variant="destructive" className="border-amber-500 bg-amber-50">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>Important:</strong> These features are for later use only. Do NOT enable on a brand-new domain.
          Recommended activation: 3-6 months after site launch, after the site has been indexed and aged.
        </AlertDescription>
      </Alert>
      
      {/* Persistence Notice */}
      <Alert className="border-blue-500 bg-blue-50">
        <Info className="w-5 h-5 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Shared Publishing State:</strong> Changes here are saved to the database and affect shared publishing state across all sessions and devices.
        </AlertDescription>
      </Alert>
      
      {/* Reminder Banner */}
      {showReminder && (
        <Alert className="border-purple-500 bg-purple-50">
          <Clock className="w-5 h-5 text-purple-600" />
          <AlertDescription className="text-purple-800">
            <strong>Activation Window:</strong> Your site is {daysSinceLaunch} days old. 
            Recommended activation window ({recommendedMonths} months) has been reached or is approaching. 
            Review the rollout guidance below.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-5 h-5 text-slate-500" />
            Summary Statistics
          </CardTitle>
          <CardDescription>
            Overview of expansion pages and their publication status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-slate-800">{stats?.totalExpansionPages || 0}</div>
              <div className="text-xs text-slate-500 mt-1">Total Pages</div>
            </div>
            <div className="p-4 bg-slate-100 rounded-lg text-center">
              <div className="text-2xl font-bold text-slate-700">{stats?.draftCount || 0}</div>
              <div className="text-xs text-slate-500 mt-1">Draft</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg text-center border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">{stats?.reviewedCount || 0}</div>
              <div className="text-xs text-blue-600 mt-1">Reviewed</div>
            </div>
            <div className="p-4 bg-emerald-50 rounded-lg text-center border border-emerald-200">
              <div className="text-2xl font-bold text-emerald-700">{stats?.approvedCount || 0}</div>
              <div className="text-xs text-emerald-600 mt-1">Approved</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center border border-green-200">
              <div className="text-2xl font-bold text-green-700">{stats?.publishedCount || 0}</div>
              <div className="text-xs text-green-600 mt-1">Published</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Master Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-500" />
            Master Controls
          </CardTitle>
          <CardDescription>
            Enable or disable expansion features entirely. Changes affect shared publishing state.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <Label htmlFor="pattern-pages" className="font-medium text-slate-800">
                  Pattern Pages
                </Label>
              </div>
              <p className="text-sm text-slate-500 ml-7">
                Answer pattern guides ({stats?.totalPatternPages} pages prepared)
              </p>
            </div>
            <Switch
              id="pattern-pages"
              checked={patternPagesEnabled}
              onCheckedChange={setPatternPagesEnabled}
            />
          </div>
          
          <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                <Label htmlFor="situation-pages" className="font-medium text-slate-800">
                  Situation Pages
                </Label>
              </div>
              <p className="text-sm text-slate-500 ml-7">
                Situation-specific help pages ({stats?.totalSituationPages} pages prepared)
              </p>
            </div>
            <Switch
              id="situation-pages"
              checked={situationPagesEnabled}
              onCheckedChange={setSituationPagesEnabled}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Safety Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldIcon />
            Safety Controls
          </CardTitle>
          <CardDescription>
            Configure how expansion pages appear to search engines
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Map className="w-4 h-4 text-slate-500" />
                <Label className="font-medium text-slate-800">Include in Sitemap</Label>
              </div>
              <p className="text-sm text-slate-500">
                Add published expansion pages to sitemap.xml
              </p>
            </div>
            <Switch
              checked={includeInSitemap}
              onCheckedChange={setIncludeInSitemap}
              disabled={!anyFeatureEnabled}
            />
          </div>
          
          <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-slate-500" />
                <Label className="font-medium text-slate-800">Noindex Until Approved</Label>
              </div>
              <p className="text-sm text-slate-500">
                Apply noindex meta tag to expansion pages by default
              </p>
            </div>
            <Switch
              checked={noindexUntilApproved}
              onCheckedChange={setNoindexUntilApproved}
              disabled={!anyFeatureEnabled}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Sitemap Rebuild Warning */}
      <Alert className="border-amber-500 bg-amber-50">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>Sitemap Rebuild Required:</strong> Publishing changes are saved immediately to the database, 
          but sitemap updates only appear after the next site rebuild/deploy. Newly published pages may not 
          appear in search engine results until the rebuild completes.
        </AlertDescription>
      </Alert>
      
      {/* Sitemap Sync Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Map className="w-5 h-5 text-slate-500" />
            Sitemap Sync Status
          </CardTitle>
          <CardDescription>
            Current status of published pages and sitemap synchronization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sitemapStatus ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-slate-800">
                    {sitemapStatus.published_pages_count}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Published Pages</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-amber-600">
                    {sitemapStatus.pages_not_in_sitemap}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Estimated Waiting
                    {!sitemapStatus.is_pages_not_in_sitemap_exact && (
                      <span className="block text-[10px] text-amber-600">(approximate)</span>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-slate-800">
                    {sitemapStatus.last_rebuild_triggered_at 
                      ? new Date(sitemapStatus.last_rebuild_triggered_at).toLocaleDateString()
                      : 'Never'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Last Rebuild Triggered
                    {!sitemapStatus.is_last_sync_exact && (
                      <span className="block text-[10px] text-slate-500">(trigger time)</span>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-slate-800">
                    {sitemapStatus.last_scheduler_run_at
                      ? new Date(sitemapStatus.last_scheduler_run_at).toLocaleDateString()
                      : 'Never'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Last Rollout</div>
                </div>
              </div>
              
              {sitemapStatus.last_rebuild_status === 'triggered' && sitemapStatus.estimated_completion_at && (
                <Alert className="border-blue-500 bg-blue-50">
                  <Info className="w-4 h-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Rebuild in progress:</strong> Triggered at{' '}
                    {new Date(sitemapStatus.last_rebuild_triggered_at!).toLocaleTimeString()}. 
                    Estimated completion: {new Date(sitemapStatus.estimated_completion_at).toLocaleTimeString()}
                  </AlertDescription>
                </Alert>
              )}
              
              {sitemapStatus.pages_not_in_sitemap > 0 && sitemapStatus.last_rebuild_status !== 'triggered' && (
                <Alert className="border-blue-500 bg-blue-50">
                  <Info className="w-4 h-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    Approximately <strong>{sitemapStatus.pages_not_in_sitemap} pages</strong> may be waiting for the next rebuild. 
                    Trigger a rebuild below to update the sitemap.
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">Loading sitemap status...</p>
          )}
        </CardContent>
      </Card>
      
      {/* Coolify Rebuild Trigger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="w-5 h-5 text-slate-500" />
            Trigger Coolify Rebuild
          </CardTitle>
          <CardDescription>
            Request a site rebuild to update the sitemap with newly published pages.
            Rebuilds typically take 2-5 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-4 border rounded-lg bg-slate-50">
            <div className="flex-1 space-y-3">
              <p className="text-sm text-slate-700">
                When you publish pages, they are saved immediately to the database. 
                However, the sitemap.xml file is only updated when the site rebuilds.
              </p>
              
              <Alert className="border-amber-500 bg-amber-50">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-amber-800 text-sm">
                  <strong>5-minute cooldown:</strong> Rebuilds cannot be triggered more than once every 5 minutes.
                  {lastTriggerTime && (
                    <span className="block mt-1">
                      Last triggered: {new Date(lastTriggerTime).toLocaleTimeString()}
                    </span>
                  )}
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleTriggerDeploy}
                  disabled={!anyFeatureEnabled || isTriggeringDeploy || (lastTriggerTime !== null && Date.now() - lastTriggerTime < 5 * 60 * 1000)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isTriggeringDeploy ? (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                      Sending Request...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4 mr-2" />
                      Trigger Coolify Rebuild
                    </>
                  )}
                </Button>
              </div>
              
              {deployMessage && (
                <Alert className={deployMessage.type === 'success' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
                  <AlertDescription className={deployMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                    {deployMessage.text}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
          
          {!anyFeatureEnabled && (
            <p className="text-sm text-slate-500">
              <Info className="w-4 h-4 inline mr-1" />
              Enable expansion features to trigger rebuilds.
            </p>
          )}
          
          {anyFeatureEnabled && (
            <p className="text-sm text-slate-500">
              <Info className="w-4 h-4 inline mr-1" />
              The rebuild request is sent securely. Only admin users can trigger rebuilds.
              If the button is disabled, wait for the cooldown period or contact a developer.
            </p>
          )}
        </CardContent>
      </Card>
      
      {/* Post-Publish Checklist */}
      {showPostPublishChecklist && (
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-green-700">
              <Check className="w-5 h-5" />
              Post-Publish Checklist
            </CardTitle>
            <CardDescription>
              Complete these steps after publishing pages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div 
                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  checklistItems.reviewed ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'
                }`}
                onClick={() => setChecklistItems(prev => ({ ...prev, reviewed: !prev.reviewed }))}
              >
                <Checkbox checked={checklistItems.reviewed} />
                <div>
                  <div className="font-medium text-slate-800">Review published pages</div>
                  <p className="text-sm text-slate-500">
                    Verify the published pages look correct and contain the right content
                  </p>
                </div>
              </div>
              
              <div 
                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  checklistItems.settings ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'
                }`}
                onClick={() => setChecklistItems(prev => ({ ...prev, settings: !prev.settings }))}
              >
                <Checkbox checked={checklistItems.settings} />
                <div>
                  <div className="font-medium text-slate-800">Confirm noindex/sitemap settings</div>
                  <p className="text-sm text-slate-500">
                    Verify pages have correct noindex and sitemap inclusion settings
                  </p>
                </div>
              </div>
              
              <div 
                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  checklistItems.rebuild ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'
                }`}
                onClick={() => {
                  setChecklistItems(prev => ({ ...prev, rebuild: !prev.rebuild }));
                }}
              >
                <Checkbox checked={checklistItems.rebuild} />
                <div className="flex-1">
                  <div className="font-medium text-slate-800">Trigger Coolify rebuild</div>
                  <p className="text-sm text-slate-500">
                    Click the button below to trigger a rebuild, or check this box if you plan to rebuild later.
                    Rebuilds take 2-5 minutes and update the sitemap.
                  </p>
                  {!checklistItems.rebuild && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTriggerDeploy();
                      }}
                      disabled={isTriggeringDeploy || (lastTriggerTime !== null && Date.now() - lastTriggerTime < 5 * 60 * 1000)}
                    >
                      <Rocket className="w-3 h-3 mr-1" />
                      {isTriggeringDeploy ? 'Sending...' : 'Trigger Rebuild'}
                    </Button>
                  )}
                </div>
              </div>
              
              <div 
                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  checklistItems.rechecked ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'
                }`}
                onClick={() => setChecklistItems(prev => ({ ...prev, rechecked: !prev.rechecked }))}
              >
                <Checkbox checked={checklistItems.rechecked} />
                <div>
                  <div className="font-medium text-slate-800">Recheck sitemap after deploy</div>
                  <p className="text-sm text-slate-500">
                    After rebuild completes, verify pages appear in sitemap.xml
                  </p>
                </div>
              </div>
            </div>
            
            {checklistItems.reviewed && checklistItems.settings && checklistItems.rebuild && checklistItems.rechecked && (
              <Alert className="border-green-500 bg-green-50">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  All checklist items completed! Your published pages should now be live and discoverable.
                </AlertDescription>
              </Alert>
            )}
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowPostPublishChecklist(false)}
              className="text-slate-500"
            >
              Hide Checklist
            </Button>
          </CardContent>
        </Card>
      )}
      
      {/* Review Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-slate-500" />
            Review Queue
          </CardTitle>
          <CardDescription>
            Review, approve, and publish expansion pages individually or in bulk.
            All changes are saved to shared publishing state.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bulk Actions */}
          <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-lg">
            <span className="text-sm font-medium text-slate-700 mr-2">Bulk Actions:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={pageStates.length === 0}
            >
              {selectAll ? 'Deselect All' : 'Select All'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectByStatus('reviewed')}
            >
              Select Reviewed
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectByStatus('approved')}
            >
              Select Approved
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectByType('pattern')}
            >
              Select Patterns
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectByType('situation')}
            >
              Select Situations
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectRecommended}
              className="text-purple-600 border-purple-200"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              AI Recommended
            </Button>
            
            {selectedSlugs.size > 0 && (
              <>
                <Separator orientation="vertical" className="h-6 mx-2" />
                <span className="text-sm text-slate-500">
                  {selectedSlugs.size} selected
                </span>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkPublish}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Publish
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkUnpublish}
                >
                  <EyeOff className="w-3 h-3 mr-1" />
                  Unpublish
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkMarkReviewed}
                >
                  Mark Reviewed
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkMarkApproved}
                >
                  Mark Approved
                </Button>
              </>
            )}
          </div>
          
          {/* Pages Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Parent Cluster</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Sitemap</TableHead>
                  <TableHead>Noindex</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagesWithRecommendations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                      No pages found
                    </TableCell>
                  </TableRow>
                ) : (
                  pagesWithRecommendations.map((page) => (
                    <TableRow key={page.slug}>
                      <TableCell>
                        <Checkbox
                          checked={selectedSlugs.has(page.slug)}
                          onCheckedChange={() => toggleSelection(page.slug)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-medium text-slate-800 text-sm">
                            {page.page_type === 'pattern' 
                              ? PATTERN_PAGES.find(p => p.slug === page.slug)?.title
                              : SITUATION_PAGES_CONFIG.find(p => p.slug === page.slug)?.title
                            }
                          </div>
                          <div className="text-xs text-slate-400">/{page.slug}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {page.page_type === 'pattern' ? 'Pattern' : 'Situation'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-600">
                          {page.parent_cluster || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={page.status} />
                      </TableCell>
                      <TableCell>
                        {page.recommendation && (
                          <PriorityIndicator priority={page.recommendation.recommended_priority} />
                        )}
                      </TableCell>
                      <TableCell>
                        {page.include_in_sitemap ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <X className="w-4 h-4 text-slate-300" />
                        )}
                      </TableCell>
                      <TableCell>
                        {page.noindex_override ? (
                          <EyeOff className="w-4 h-4 text-amber-500" />
                        ) : (
                          <Eye className="w-4 h-4 text-green-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {page.status !== 'published' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePublishPage(page.slug)}
                              className="text-green-600"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          {page.status === 'published' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnpublishPage(page.slug)}
                              className="text-amber-600"
                            >
                              <EyeOff className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {/* AI Recommendations */}
      <Collapsible open={showAIRecommendations} onOpenChange={setShowAIRecommendations}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                AI-Assisted Recommendations
              </CardTitle>
              {showAIRecommendations ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </CollapsibleTrigger>
            <CardDescription>
              Rule-based recommendations to help prioritize pages for rollout
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Top Recommendations for Early Publish
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {recommendations
                    .filter(r => r.recommended_for_early_publish)
                    .slice(0, 4)
                    .map(rec => (
                      <div key={rec.slug} className="p-3 border rounded-lg bg-purple-50/50">
                        <div className="flex items-start justify-between">
                          <div className="font-medium text-sm text-slate-800">
                            {PATTERN_PAGES.find(p => p.slug === rec.slug)?.title ||
                             SITUATION_PAGES_CONFIG.find(p => p.slug === rec.slug)?.title}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {rec.recommended_priority}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{rec.quality_hint}</div>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      
      {/* Rollout Rules & Manual Execution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-slate-500" />
            Rollout Rules & Manual Execution
          </CardTitle>
          <CardDescription>
            Configure timing rules for gradual rollout. Execution is manual from this dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Scheduler Rules */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-blue-500" />
                <Label className="font-medium text-slate-800">
                  Enable Rollout Rules
                </Label>
              </div>
              <p className="text-sm text-slate-500">
                Configure timing and selection rules for manual rollout execution
              </p>
            </div>
            <Switch
              checked={schedulerEnabled}
              onCheckedChange={setSchedulerEnabled}
              disabled={!anyFeatureEnabled}
            />
          </div>
          
          {schedulerEnabled && (
            <>
              <div className="pl-4 border-l-2 border-slate-200 space-y-4">
                {/* Frequency & Page Count */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select
                      value={schedulerFrequency}
                      onValueChange={(v) => setSchedulerFrequency(v as RolloutFrequency)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Page Count Mode</Label>
                    <Select
                      value={pageCountMode}
                      onValueChange={(v) => setPageCountMode(v as PageCountMode)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed Number</SelectItem>
                        <SelectItem value="random">Random Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Page Count Settings */}
                {pageCountMode === 'fixed' ? (
                  <div className="space-y-2">
                    <Label>Pages Per Cycle</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={fixedPageCount}
                      onChange={(e) => setFixedPageCount(parseInt(e.target.value) || 1)}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Min Pages</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={randomMinPages}
                        onChange={(e) => setRandomMinPages(parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Pages</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={randomMaxPages}
                        onChange={(e) => setRandomMaxPages(parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </div>
                )}
                
                {/* Scheduler Options */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Only Publish Approved Pages</Label>
                      <p className="text-xs text-slate-500">
                        Only pages with &quot;approved&quot; status will be selected
                      </p>
                    </div>
                    <Switch
                      checked={schedulerOnlyApproved}
                      onCheckedChange={setSchedulerOnlyApproved}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Auto-Include in Sitemap</Label>
                      <p className="text-xs text-slate-500">
                        Automatically add published pages to sitemap
                      </p>
                    </div>
                    <Switch
                      checked={schedulerAutoSitemap}
                      onCheckedChange={setSchedulerAutoSitemap}
                    />
                  </div>
                </div>
              </div>
              
              {/* Manual Execution Buttons */}
              <div className="p-4 border rounded-lg bg-blue-50 space-y-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-800">Manual Rollout Execution</span>
                </div>
                <p className="text-sm text-blue-700">
                  Automatic timing rules can be configured above. For now, rollout is executed manually from this dashboard. 
                  Use &quot;Preview Next Batch&quot; to review before publishing.
                </p>
                
                <div className="flex flex-wrap gap-3">
                  <Dialog open={showSchedulerPreview} onOpenChange={setShowSchedulerPreview}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        onClick={handlePreviewScheduler}
                        disabled={!schedulerEnabled}
                      >
                        <ListTodo className="w-4 h-4 mr-2" />
                        Preview Next Batch
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Preview Next Rollout Batch</DialogTitle>
                        <DialogDescription>
                          These pages would be selected for the next rollout cycle based on current rules.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {schedulerPreview ? (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 bg-slate-50 rounded">
                                <div className="text-2xl font-bold">{schedulerPreview.wouldPublishCount}</div>
                                <div className="text-xs text-slate-500">Pages Selected</div>
                              </div>
                              <div className="p-3 bg-slate-50 rounded">
                                <div className="text-2xl font-bold">{schedulerPreview.isRandom ? 'Yes' : 'No'}</div>
                                <div className="text-xs text-slate-500">Random Selection</div>
                              </div>
                            </div>
                            {schedulerPreview.eligibleSlugs.length > 0 ? (
                              <div className="space-y-2">
                                <Label>Selected Pages:</Label>
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                  {schedulerPreview.eligibleSlugs.map(slug => (
                                    <div key={slug} className="text-sm p-2 bg-slate-50 rounded">
                                      {PATTERN_PAGES.find(p => p.slug === slug)?.title ||
                                       SITUATION_PAGES_CONFIG.find(p => p.slug === slug)?.title || slug}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <Alert>
                                <AlertCircle className="w-4 h-4" />
                                <AlertDescription>
                                  No eligible pages found. Make sure pages are approved and not already published.
                                </AlertDescription>
                              </Alert>
                            )}
                          </>
                        ) : (
                          <p>Loading preview...</p>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Button 
                    onClick={handleRunScheduler}
                    disabled={!schedulerEnabled || isRunningScheduler}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isRunningScheduler ? (
                      <>
                        <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-4 h-4 mr-2" />
                        Run Next Cycle Now
                      </>
                    )}
                  </Button>
                </div>
                
                {/* Scheduler Result */}
                {schedulerResult && (
                  <div className="p-4 bg-white rounded border">
                    <h4 className="font-medium mb-2">Last Execution Result</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">Published:</span>
                        <span className="ml-2 font-medium">{schedulerResult.count}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Failed:</span>
                        <span className="ml-2 font-medium">{schedulerResult.failed.length}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Duration:</span>
                        <span className="ml-2 font-medium">{schedulerResult.durationMs}ms</span>
                      </div>
                    </div>
                    {schedulerResult.published.length > 0 && (
                      <div className="mt-2 text-sm">
                        <span className="text-slate-500">Published pages:</span>
                        <span className="ml-2">{schedulerResult.published.join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
          
          {!anyFeatureEnabled && (
            <p className="text-sm text-slate-500">
              <Info className="w-4 h-4 inline mr-1" />
              Enable expansion features to configure rollout rules.
            </p>
          )}
        </CardContent>
      </Card>
      
      {/* Execution History */}
      <Collapsible open={showRunHistory} onOpenChange={setShowRunHistory}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-5 h-5 text-slate-500" />
                Rollout Execution History
              </CardTitle>
              {showRunHistory ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </CollapsibleTrigger>
            <CardDescription>
              Recent manual rollout executions and their results
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {runHistory.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  No rollout executions yet. Run your first cycle above.
                </p>
              ) : (
                <div className="space-y-3">
                  {runHistory.map((run) => (
                    <div key={run.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Timer className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium">
                            {new Date(run.created_at).toLocaleString()}
                          </span>
                          {run.triggered_manually && (
                            <Badge variant="outline" className="text-xs">Manual</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500">
                            {run.pages_published} / {run.pages_considered} published
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant={run.sitemap_included ? "default" : "secondary"}>
                          Sitemap: {run.sitemap_included ? 'Yes' : 'No'}
                        </Badge>
                        <Badge variant={run.noindex_respected ? "default" : "secondary"}>
                          Noindex: {run.noindex_respected ? 'Yes' : 'No'}
                        </Badge>
                        <Badge variant={run.only_approved_published ? "default" : "secondary"}>
                          Only Approved: {run.only_approved_published ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      {run.published_slugs.length > 0 && (
                        <div className="mt-2 text-xs text-slate-500">
                          Published: {run.published_slugs.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      
      {/* Rollout Guidance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-5 h-5 text-slate-500" />
            SEO Rollout Guidance
          </CardTitle>
          <CardDescription>
            Timeline and recommendations for gradual SEO expansion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Launch Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Site Launch Date</Label>
              <Input
                type="date"
                value={launchDate}
                onChange={(e) => setLaunchDate(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Used to calculate recommended activation timing
              </p>
            </div>
            <div className="space-y-2">
              <Label>Recommended Activation</Label>
              <Select
                value={recommendedMonths.toString()}
                onValueChange={(v) => setRecommendedMonths(parseInt(v) as 3 | 4 | 6)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 months after launch</SelectItem>
                  <SelectItem value="4">4 months after launch</SelectItem>
                  <SelectItem value="6">6 months after launch (conservative)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Days Since Launch */}
          {daysSinceLaunch !== null && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800">
                <Clock className="w-4 h-4" />
                <span className="font-medium">
                  {daysSinceLaunch} days since launch
                </span>
              </div>
            </div>
          )}
          
          {/* Current Phase */}
          <div className={`p-4 rounded-lg border ${
            rolloutPhase.phase === 1 ? 'bg-slate-50 border-slate-200' :
            rolloutPhase.phase === 2 ? 'bg-blue-50 border-blue-200' :
            'bg-emerald-50 border-emerald-200'
          }`}>
            <h4 className={`font-medium mb-2 ${
              rolloutPhase.phase === 1 ? 'text-slate-800' :
              rolloutPhase.phase === 2 ? 'text-blue-800' :
              'text-emerald-800'
            }`}>
              {rolloutPhase.name}
            </h4>
            <p className={`text-sm mb-3 ${
              rolloutPhase.phase === 1 ? 'text-slate-600' :
              rolloutPhase.phase === 2 ? 'text-blue-700' :
              'text-emerald-700'
            }`}>
              {rolloutPhase.description}
            </p>
            <ul className={`text-sm space-y-1 list-disc list-inside ${
              rolloutPhase.phase === 1 ? 'text-slate-600' :
              rolloutPhase.phase === 2 ? 'text-blue-700' :
              'text-emerald-700'
            }`}>
              {rolloutPhase.actions.map((action, i) => (
                <li key={i}>{action}</li>
              ))}
            </ul>
          </div>
          
          {/* All Phases */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-700">Complete Rollout Plan</h4>
            
            <div className="space-y-2">
              <div className="p-3 border rounded-lg bg-slate-50">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">Phase 1</Badge>
                  <span className="font-medium text-slate-800">Launch to Month 3</span>
                </div>
                <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside ml-4">
                  <li>Keep expansion pages OFF</li>
                  <li>Keep sitemap inclusion OFF</li>
                  <li>Keep noindex ON</li>
                  <li>Focus on indexing core pages first</li>
                </ul>
              </div>
              
              <div className="p-3 border rounded-lg bg-blue-50">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="border-blue-300">Phase 2</Badge>
                  <span className="font-medium text-blue-800">Month 3 to 4</span>
                </div>
                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside ml-4">
                  <li>Begin with only approved pages</li>
                  <li>Publish 2–4 expansion pages at a time</li>
                  <li>Keep them noindex first if doing a soft rollout</li>
                  <li>Do not add everything to sitemap immediately</li>
                </ul>
              </div>
              
              <div className="p-3 border rounded-lg bg-emerald-50">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="border-emerald-300">Phase 3</Badge>
                  <span className="font-medium text-emerald-800">Month 4 to 6+</span>
                </div>
                <ul className="text-sm text-emerald-700 space-y-1 list-disc list-inside ml-4">
                  <li>Consider adding selected published pages to sitemap</li>
                  <li>Remove noindex only when pages are reviewed and ready</li>
                  <li>Gradually increase rollout if indexing is healthy</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Admin Helper Text */}
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-sm space-y-1">
              <p><strong>Best Practices:</strong></p>
              <ul className="list-disc list-inside ml-2">
                <li>Use &quot;Preview Next Rollout Batch&quot; before publishing</li>
                <li>&quot;Run Scheduler Now&quot; executes one safe rollout cycle</li>
                <li>Keep sitemap inclusion off until pages are reviewed and ready</li>
                <li>Recommended activation window: 3–6 months after launch</li>
              </ul>
            </AlertDescription>
          </Alert>
          
          {/* Reminder Banner Toggle */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-sm">Show Reminder Banner</Label>
              <p className="text-xs text-slate-500">
                Display notification when activation window approaches
              </p>
            </div>
            <Switch
              checked={reminderBanner}
              onCheckedChange={setReminderBanner}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Current Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Expansion Pages</span>
              <span className={`font-medium ${anyFeatureEnabled ? 'text-amber-600' : 'text-emerald-600'}`}>
                {anyFeatureEnabled ? 'ON' : 'OFF (Safe)'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Rollout Rules</span>
              <span className={`font-medium ${schedulerEnabled ? 'text-blue-600' : 'text-slate-500'}`}>
                {schedulerEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Include in Sitemap</span>
              <span className={`font-medium ${includeInSitemap ? 'text-blue-600' : 'text-slate-500'}`}>
                {includeInSitemap ? 'ON' : 'OFF (Safe)'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Noindex Until Approved</span>
              <span className={`font-medium ${noindexUntilApproved ? 'text-emerald-600' : 'text-amber-600'}`}>
                {noindexUntilApproved ? 'ON (Safe)' : 'OFF'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Recommended Activation</span>
              <span className="font-medium text-slate-800">
                {recommendedMonths} months after launch
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-600">Publicly Visible Pages</span>
              <span className={`font-medium ${stats?.publishedCount ? 'text-amber-600' : 'text-emerald-600'}`}>
                {stats?.publishedCount || 0} pages
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Save Button */}
      <div className="flex items-center gap-4">
        <Button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-slate-700 hover:bg-slate-800"
        >
          {isSaving ? (
            <>Saving...</>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
        
        {anyFeatureEnabled && (
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">
              Warning: Expansion features are enabled
            </span>
          </div>
        )}
        
        {!anyFeatureEnabled && (
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">
              All expansion features safely disabled
            </span>
          </div>
        )}
      </div>
      
      {/* Safety Note */}
      <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <p className="font-medium text-slate-700 mb-1">Safety Information</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>All expansion pages are disabled by default</li>
          <li>No public routes are created until features are enabled</li>
          <li>No sitemap entries are generated for unpublished pages</li>
          <li>Pages are only visible to users if explicitly published</li>
          <li>Recommended activation: 3-6 months after initial site launch</li>
          <li>Even when enabled, pages can be kept out of sitemap and noindexed</li>
          <li>Use the review queue to approve and publish pages individually or in bulk</li>
          <li>All changes are saved to the database and immediately authoritative</li>
        </ul>
      </div>
    </div>
  );
}

// Shield icon component
function ShieldIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-500"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
