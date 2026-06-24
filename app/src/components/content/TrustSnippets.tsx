/**
 * Trust Snippets
 * Renders trust/verification badges for a specific placement
 * 
 * Features:
 * - Analytics tracking (views, CTA clicks)
 * - Multiple layout options
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Lock, 
  CheckCircle, 
  Mail, 
  Cloud, 
  FileCheck, 
  Calendar, 
  CreditCard, 
  Star, 
  Heart, 
  Award, 
  Zap, 
  Users, 
  MessageCircle, 
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  type TrustSnippet,
  type Placement,
  getActiveTrustSnippets,
  recordContentInteraction,
  hasRecordedInteraction,
  markInteractionRecorded,
} from '@/lib/content/api';
import { useOptionalAuth } from '@/lib/auth/AuthContext';
import { useEntitlements } from '@/lib/entitlements/hooks';

// Icon mapping
const ICON_COMPONENTS: Record<string, typeof Shield> = {
  Shield,
  Lock,
  CheckCircle,
  Mail,
  Cloud,
  FileCheck,
  Calendar,
  CreditCard,
  Star,
  Heart,
  Award,
  Zap,
  Users,
  MessageCircle,
  HelpCircle,
};

interface TrustSnippetsProps {
  placement: Placement;
  className?: string;
  layout?: 'grid' | 'row' | 'compact';
  maxItems?: number;
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

export function TrustSnippets({ 
  placement, 
  className,
  layout = 'grid',
  maxItems
}: TrustSnippetsProps) {
  const { isAuthenticated, user } = useOptionalAuth();
  const { subscription } = useEntitlements();
  const [snippets, setSnippets] = useState<TrustSnippet[]>([]);
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

  // Load snippets
  useEffect(() => {
    const loadSnippets = async () => {
      setIsLoading(true);
      const userRole = getUserRole();
      const { data } = await getActiveTrustSnippets(
        placement, 
        isAuthenticated && user ? user.id : undefined, 
        userRole
      );
      const loadedSnippets = data || [];
      setSnippets(maxItems ? loadedSnippets.slice(0, maxItems) : loadedSnippets);
      setIsLoading(false);
    };

    loadSnippets();
  }, [placement, isAuthenticated, subscription, maxItems, user]);

  // Track view analytics with deduping
  useEffect(() => {
    if (isLoading || snippets.length === 0) return;

    const sessionId = getSessionId();
    
    snippets.forEach(snippet => {
      // Check both useRef (fast, current render) and sessionStorage (across remounts)
      if (!viewedIds.current.has(snippet.id) && 
          !hasRecordedInteraction('trust_snippet', snippet.id, 'view', placement)) {
        
        viewedIds.current.add(snippet.id);
        markInteractionRecorded('trust_snippet', snippet.id, 'view', placement);
        
        // Record view analytics (non-blocking)
        recordContentInteraction(
          'trust_snippet',
          snippet.id,
          'view',
          placement,
          sessionId
        ).catch(console.error);
      }
    });
  }, [snippets, isLoading, placement]);

  // Handle CTA click with deduping
  const handleCtaClick = (snippet: TrustSnippet) => {
    // Record CTA click (deduped within session)
    if (!hasRecordedInteraction('trust_snippet', snippet.id, 'cta_click', placement)) {
      markInteractionRecorded('trust_snippet', snippet.id, 'cta_click', placement);
      recordContentInteraction(
        'trust_snippet',
        snippet.id,
        'cta_click',
        placement,
        getSessionId()
      ).catch(console.error);
    }

    if (snippet.cta_link) {
      if (snippet.cta_link.startsWith('/')) {
        window.location.href = snippet.cta_link;
      } else {
        window.open(snippet.cta_link, '_blank');
      }
    }
  };

  if (isLoading || snippets.length === 0) {
    return null;
  }

  // Grid layout (default for home.trust)
  if (layout === 'grid') {
    return (
      <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
        {snippets.map((snippet) => {
          const IconComponent = ICON_COMPONENTS[snippet.icon_name] || Shield;
          
          return (
            <div
              key={snippet.id}
              className="flex items-start gap-3 p-4 bg-white rounded-lg border border-slate-200"
            >
              <div className="p-2 bg-slate-100 rounded-lg shrink-0">
                <IconComponent className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-slate-800 text-sm">{snippet.title}</h4>
                {snippet.subtitle && (
                  <p className="text-xs text-slate-500 mt-0.5">{snippet.subtitle}</p>
                )}
                {snippet.cta_text && snippet.cta_link && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 mt-1 text-xs text-slate-600"
                    onClick={() => handleCtaClick(snippet)}
                  >
                    {snippet.cta_text}
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Row layout (for checkout, auth pages)
  if (layout === 'row') {
    return (
      <div className={cn('flex flex-wrap items-center justify-center gap-4', className)}>
        {snippets.map((snippet) => {
          const IconComponent = ICON_COMPONENTS[snippet.icon_name] || Shield;
          
          return (
            <div
              key={snippet.id}
              className="flex items-center gap-2 text-sm text-slate-600"
            >
              <IconComponent className="w-4 h-4 text-slate-400" />
              <span>{snippet.title}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // Compact layout (for sidebars, small spaces)
  return (
    <div className={cn('space-y-2', className)}>
      {snippets.map((snippet) => {
        const IconComponent = ICON_COMPONENTS[snippet.icon_name] || Shield;
        
        return (
          <div
            key={snippet.id}
            className="flex items-center gap-2 text-xs text-slate-500"
          >
            <IconComponent className="w-3 h-3 text-slate-400" />
            <span>{snippet.title}</span>
          </div>
        );
      })}
    </div>
  );
}
