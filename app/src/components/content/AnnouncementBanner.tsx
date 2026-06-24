/**
 * Announcement Banner
 * Renders announcements for a specific placement
 * 
 * Features:
 * - Synced dismissals for logged-in users (Supabase)
 * - localStorage fallback for anonymous users
 * - Analytics tracking (views, dismissals, CTA clicks)
 * - Safe markdown-lite formatting
 */

import { useState, useEffect, useRef } from 'react';
import { X, Info, CheckCircle, AlertTriangle, Calendar, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  type Announcement,
  type AnnouncementType,
  type Placement,
  getActiveAnnouncements,
  dismissContent,
  recordContentInteraction,
  parseMarkdownLite,
  type FormattedSegment,
  hasRecordedInteraction,
  markInteractionRecorded,
  isExternalUrl,
} from '@/lib/content/api';
import { useOptionalAuth } from '@/lib/auth/AuthContext';
import { useEntitlements } from '@/lib/entitlements/hooks';

const TYPE_ICONS: Record<AnnouncementType, typeof Info> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  update: Calendar,
  promo: Megaphone,
};

const TYPE_STYLES: Record<AnnouncementType, string> = {
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  update: 'bg-purple-50 border-purple-200 text-purple-800',
  promo: 'bg-pink-50 border-pink-200 text-pink-800',
};

interface AnnouncementBannerProps {
  placement: Placement;
  className?: string;
}

// Generate a simple session ID for anonymous analytics
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('content_session_id');
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('content_session_id', sessionId);
  }
  return sessionId;
}

// Render formatted segments safely
function renderFormattedSegments(segments: FormattedSegment[]): React.ReactNode {
  return segments.map((segment, index) => {
    switch (segment.type) {
      case 'bold':
        return <strong key={index} className="font-semibold">{segment.content}</strong>;
      case 'italic':
        return <em key={index} className="italic">{segment.content}</em>;
      case 'bold_italic':
        return <strong key={index} className="font-semibold italic">{segment.content}</strong>;
      case 'link': {
        const href = segment.href || '';
        const external = isExternalUrl(href);
        return (
          <a
            key={index}
            href={href}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className="underline hover:no-underline"
            onClick={(e) => e.stopPropagation()}
          >
            {segment.content}
          </a>
        );
      }
      default:
        return <span key={index}>{segment.content}</span>;
    }
  });
}

export function AnnouncementBanner({ placement, className }: AnnouncementBannerProps) {
  const { isAuthenticated, user } = useOptionalAuth();
  const { subscription } = useEntitlements();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [localDismissedIds, setLocalDismissedIds] = useState<string[]>([]);
  const [serverDismissedIds, setServerDismissedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const viewedIds = useRef<Set<string>>(new Set());

  // Determine user role for targeting based on auth + subscription state
  const getUserRole = () => {
    if (!isAuthenticated) return 'anonymous';
    if (!subscription) return 'logged_in';
    
    if (subscription.status === 'expired') return 'expired';
    if (subscription.planType === 'trial') return 'trial';
    if (['monthly', 'lifetime', 'interviewPass'].includes(subscription.planType)) return 'paid';
    
    return 'logged_in';
  };

  // Load announcements
  useEffect(() => {
    const loadAnnouncements = async () => {
      setIsLoading(true);
      const userRole = getUserRole();
      // Only pass userId if user is authenticated
      const { data } = await getActiveAnnouncements(
        placement, 
        isAuthenticated && user ? user.id : undefined, 
        userRole
      );
      setAnnouncements(data || []);
      setIsLoading(false);
    };

    loadAnnouncements();
  }, [placement, isAuthenticated, subscription, user]);

  // Load localStorage dismissed IDs (for anonymous users or as fallback)
  useEffect(() => {
    const stored = localStorage.getItem(`dismissed_announcements_${placement}`);
    if (stored) {
      setLocalDismissedIds(JSON.parse(stored));
    }
  }, [placement]);

  // Load server-side dismissed IDs for logged-in users
  // Also retry any pending dismissals that failed to sync previously
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setServerDismissedIds([]);
      return;
    }

    const loadServerDismissals = async () => {
      // First, retry any pending dismissals from previous failed attempts
      await syncPendingDismissals(user.id);
      
      // Then load current server state
      const { data, error } = await supabase
        .rpc('get_dismissed_content_ids', {
          p_user_id: user.id,
          p_content_type: 'announcement',
          p_placement: placement,
        });
      
      if (!error && data) {
        setServerDismissedIds(data as string[]);
      }
    };

    loadServerDismissals();
  }, [isAuthenticated, user, placement]);

  // Track view analytics with deduping
  useEffect(() => {
    if (isLoading || announcements.length === 0) return;

    const sessionId = getSessionId();
    
    announcements.forEach(announcement => {
      // Check both useRef (fast, current render) and sessionStorage (across remounts)
      if (!viewedIds.current.has(announcement.id) && 
          !hasRecordedInteraction('announcement', announcement.id, 'view', placement)) {
        
        viewedIds.current.add(announcement.id);
        markInteractionRecorded('announcement', announcement.id, 'view', placement);
        
        // Record view analytics (non-blocking)
        recordContentInteraction(
          'announcement',
          announcement.id,
          'view',
          placement,
          sessionId
        ).catch(console.error);
      }
    });
  }, [announcements, isLoading, placement]);

  // Handle dismiss with resilience for sync failures
  const handleDismiss = async (announcement: Announcement) => {
    // Always update local state immediately for responsive UI (never wait for server)
    const newLocalDismissed = [...localDismissedIds, announcement.id];
    setLocalDismissedIds(newLocalDismissed);
    localStorage.setItem(`dismissed_announcements_${placement}`, JSON.stringify(newLocalDismissed));

    // For logged-in users, also sync to server
    if (isAuthenticated && user) {
      const success = await dismissContent('announcement', announcement.id, placement);
      if (success) {
        setServerDismissedIds(prev => [...prev, announcement.id]);
        // Remove from pending sync queue if it was there
        removePendingDismissal('announcement', announcement.id);
      } else {
        // Server sync failed - queue for retry on next load
        queuePendingDismissal('announcement', announcement.id, placement);
        // Don't show error to user - dismissal is still saved locally
      }
    }

    // Record dismissal analytics (deduped)
    if (!hasRecordedInteraction('announcement', announcement.id, 'dismiss', placement)) {
      markInteractionRecorded('announcement', announcement.id, 'dismiss', placement);
      recordContentInteraction(
        'announcement',
        announcement.id,
        'dismiss',
        placement,
        getSessionId()
      ).catch(console.error);
    }
  };

  // Handle CTA click
  const handleCtaClick = (announcement: Announcement) => {
    recordContentInteraction(
      'announcement',
      announcement.id,
      'cta_click',
      placement,
      getSessionId()
    ).catch(console.error);

    if (announcement.cta_link) {
      if (announcement.cta_link.startsWith('/')) {
        window.location.href = announcement.cta_link;
      } else {
        window.open(announcement.cta_link, '_blank');
      }
    }
  };

  // Combine dismissed IDs from both sources
  const allDismissedIds = isAuthenticated 
    ? [...new Set([...serverDismissedIds, ...localDismissedIds])]
    : localDismissedIds;

  // Filter out dismissed announcements
  const visibleAnnouncements = announcements.filter(
    a => !a.is_dismissible || !allDismissedIds.includes(a.id)
  );

  if (isLoading || visibleAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      {visibleAnnouncements.map((announcement) => {
        const Icon = TYPE_ICONS[announcement.announcement_type];
        const formattedBody = announcement.body ? parseMarkdownLite(announcement.body) : [];
        
        return (
          <Alert
            key={announcement.id}
            className={cn(
              'relative',
              TYPE_STYLES[announcement.announcement_type]
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <div className="flex-1">
              <AlertTitle className="text-sm font-medium">
                {announcement.title}
              </AlertTitle>
              
              {formattedBody.length > 0 && (
                <AlertDescription className="text-sm mt-1 space-y-2">
                  {formattedBody.map((paragraph, pIndex) => (
                    <p key={pIndex}>
                      {renderFormattedSegments(paragraph)}
                    </p>
                  ))}
                </AlertDescription>
              )}
              
              {announcement.cta_text && (
                <div className="mt-2">
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-inherit underline"
                    onClick={() => handleCtaClick(announcement)}
                  >
                    {announcement.cta_text}
                  </Button>
                </div>
              )}
            </div>
            
            {announcement.is_dismissible && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6 shrink-0"
                onClick={() => handleDismiss(announcement)}
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </Alert>
        );
      })}
    </div>
  );
}

// Import supabase for server-side dismissal fetching
import { supabase } from '@/lib/supabase';

// ============================================================================
// Dismissal Sync Resilience Helpers
// ============================================================================

const PENDING_DISMISSALS_KEY = 'pending_content_dismissals';

interface PendingDismissal {
  contentType: 'announcement' | 'trust_snippet' | 'content_block';
  contentId: string;
  placement?: string;
  timestamp: number;
}

/**
 * Queue a dismissal for retry if server sync fails
 */
function queuePendingDismissal(
  contentType: 'announcement' | 'trust_snippet' | 'content_block',
  contentId: string,
  placement?: string
): void {
  try {
    const pending = getPendingDismissals();
    // Don't duplicate
    if (!pending.some(p => p.contentId === contentId && p.contentType === contentType)) {
      pending.push({ contentType, contentId, placement, timestamp: Date.now() });
      localStorage.setItem(PENDING_DISMISSALS_KEY, JSON.stringify(pending));
    }
  } catch {
    // Silently fail - local dismissal still works
  }
}

/**
 * Get all pending dismissals that need to be synced
 */
function getPendingDismissals(): PendingDismissal[] {
  try {
    const stored = localStorage.getItem(PENDING_DISMISSALS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Remove a dismissal from the pending queue
 */
function removePendingDismissal(
  contentType: string,
  contentId: string
): void {
  try {
    const pending = getPendingDismissals();
    const filtered = pending.filter(
      p => !(p.contentType === contentType && p.contentId === contentId)
    );
    localStorage.setItem(PENDING_DISMISSALS_KEY, JSON.stringify(filtered));
  } catch {
    // Silently fail
  }
}

/**
 * Retry syncing pending dismissals
 */
async function syncPendingDismissals(userId: string): Promise<void> {
  const pending = getPendingDismissals();
  if (pending.length === 0) return;
  
  // Only retry dismissals from the last 7 days (avoid stale data)
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentPending = pending.filter(p => p.timestamp > cutoff);
  
  for (const item of recentPending) {
    try {
      const { error } = await supabase
        .rpc('dismiss_content', {
          p_user_id: userId,
          p_content_type: item.contentType,
          p_content_id: item.contentId,
          p_placement: item.placement || null,
        });
      
      if (!error) {
        removePendingDismissal(item.contentType, item.contentId);
      }
    } catch {
      // Will retry on next load
    }
  }
  
  // Clean up old stale entries
  const staleIds = pending.filter(p => p.timestamp <= cutoff).map(p => p.contentId);
  if (staleIds.length > 0) {
    const remaining = getPendingDismissals().filter(
      p => !staleIds.includes(p.contentId)
    );
    localStorage.setItem(PENDING_DISMISSALS_KEY, JSON.stringify(remaining));
  }
}
