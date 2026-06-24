/**
 * Content Blocks
 * Renders rich content blocks for a specific placement
 * 
 * Features:
 * - Safe markdown-lite formatting
 * - Analytics tracking (views, CTA clicks, expands)
 * - Accordion layout for FAQs
 */

import { useState, useEffect, useRef } from 'react';
import { 
  FileText,
  HelpCircle,
  List,
  CheckSquare,
  AlertTriangle,
  Star,
  Info,
  BookOpen,
  ArrowRight,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  type ContentBlock,
  type ContentBlockType,
  type Placement,
  getActiveContentBlocks,
  recordContentInteraction,
  parseMarkdownLite,
  containsBulletList,
  parseBulletList,
  type FormattedSegment,
  hasRecordedInteraction,
  markInteractionRecorded,
  isExternalUrl,
} from '@/lib/content/api';
import { useOptionalAuth } from '@/lib/auth/AuthContext';
import { useEntitlements } from '@/lib/entitlements/hooks';

const TYPE_ICONS: Record<ContentBlockType, typeof FileText> = {
  info: Info,
  faq: HelpCircle,
  comparison: List,
  steps: CheckSquare,
  warning: AlertTriangle,
  success: CheckSquare,
  promo: Star,
  note: BookOpen,
};

const TYPE_STYLES: Record<ContentBlockType, string> = {
  info: 'bg-blue-50 border-blue-200',
  faq: 'bg-white border-slate-200',
  comparison: 'bg-slate-50 border-slate-200',
  steps: 'bg-emerald-50 border-emerald-200',
  warning: 'bg-amber-50 border-amber-200',
  success: 'bg-emerald-50 border-emerald-200',
  promo: 'bg-pink-50 border-pink-200',
  note: 'bg-gray-50 border-gray-200',
};

interface ContentBlocksProps {
  placement: Placement;
  className?: string;
  groupKey?: string;
  layout?: 'cards' | 'accordion' | 'inline';
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
            className="underline hover:no-underline text-blue-600"
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

export function ContentBlocks({ 
  placement, 
  className,
  groupKey,
  layout = 'cards'
}: ContentBlocksProps) {
  const { isAuthenticated, user } = useOptionalAuth();
  const { subscription } = useEntitlements();
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
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

  // Load blocks
  useEffect(() => {
    const loadBlocks = async () => {
      setIsLoading(true);
      const userRole = getUserRole();
      const { data } = await getActiveContentBlocks(
        placement, 
        isAuthenticated && user ? user.id : undefined, 
        userRole, 
        groupKey
      );
      setBlocks(data || []);
      setIsLoading(false);
    };

    loadBlocks();
  }, [placement, isAuthenticated, subscription, groupKey, user]);

  // Track view analytics with deduping
  useEffect(() => {
    if (isLoading || blocks.length === 0) return;

    const sessionId = getSessionId();
    
    blocks.forEach(block => {
      // Check both useRef (fast, current render) and sessionStorage (across remounts)
      if (!viewedIds.current.has(block.id) && 
          !hasRecordedInteraction('content_block', block.id, 'view', placement)) {
        
        viewedIds.current.add(block.id);
        markInteractionRecorded('content_block', block.id, 'view', placement);
        
        // Record view analytics (non-blocking)
        recordContentInteraction(
          'content_block',
          block.id,
          'view',
          placement,
          sessionId
        ).catch(console.error);
      }
    });
  }, [blocks, isLoading, placement]);

  // Handle expand/collapse (for accordion) with deduping
  const handleToggleExpand = (block: ContentBlock) => {
    const isExpanded = expandedIds.has(block.id);
    
    if (!isExpanded) {
      // Recording expand (deduped - only first expand counts)
      if (!hasRecordedInteraction('content_block', block.id, 'expand', placement)) {
        markInteractionRecorded('content_block', block.id, 'expand', placement);
        recordContentInteraction(
          'content_block',
          block.id,
          'expand',
          placement,
          getSessionId()
        ).catch(console.error);
      }
      
      setExpandedIds(prev => new Set([...prev, block.id]));
    } else {
      setExpandedIds(prev => {
        const next = new Set(prev);
        next.delete(block.id);
        return next;
      });
    }
  };

  // Handle CTA click with deduping
  const handleCtaClick = (block: ContentBlock) => {
    // Record CTA click (deduped within session)
    if (!hasRecordedInteraction('content_block', block.id, 'cta_click', placement)) {
      markInteractionRecorded('content_block', block.id, 'cta_click', placement);
      recordContentInteraction(
        'content_block',
        block.id,
        'cta_click',
        placement,
        getSessionId()
      ).catch(console.error);
    }

    if (block.cta_link) {
      if (block.cta_link.startsWith('/')) {
        window.location.href = block.cta_link;
      } else {
        window.open(block.cta_link, '_blank');
      }
    }
  };

  // Render formatted body with bullet list support
  const renderBody = (body: string | null) => {
    if (!body) return null;

    // Check if it's a bullet list
    if (containsBulletList(body)) {
      const items = parseBulletList(body);
      return (
        <ul className="list-disc list-inside space-y-1 mt-2">
          {items.map((item, index) => {
            const formatted = parseMarkdownLite(item);
            return (
              <li key={index}>
                {formatted[0]?.map((segment, sIndex) => (
                  <span key={sIndex}>{renderFormattedSegments([segment])}</span>
                ))}
              </li>
            );
          })}
        </ul>
      );
    }

    // Regular formatted text
    const paragraphs = parseMarkdownLite(body);
    return (
      <div className="space-y-2 mt-2">
        {paragraphs.map((paragraph, pIndex) => (
          <p key={pIndex} className="text-sm text-slate-600">
            {renderFormattedSegments(paragraph)}
          </p>
        ))}
      </div>
    );
  };

  if (isLoading || blocks.length === 0) {
    return null;
  }

  // Accordion layout (for FAQs)
  if (layout === 'accordion') {
    return (
      <div className={cn('space-y-2', className)}>
        {blocks.map((block) => {
          const isExpanded = expandedIds.has(block.id);
          
          return (
            <div
              key={block.id}
              className="bg-white border border-slate-200 rounded-lg overflow-hidden"
            >
              <button
                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
                onClick={() => handleToggleExpand(block)}
              >
                <span className="font-medium text-slate-800">{block.title}</span>
                <ChevronDown className={cn(
                  "w-5 h-5 text-slate-400 transition-transform",
                  isExpanded && "rotate-180"
                )} />
              </button>
              
              {isExpanded && (
                <div className="px-4 pb-4 text-sm text-slate-600 border-t border-slate-100">
                  {renderBody(block.body)}
                  
                  {block.cta_text && block.cta_link && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 mt-3"
                      onClick={() => handleCtaClick(block)}
                    >
                      {block.cta_text}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Cards layout (default)
  if (layout === 'cards') {
    return (
      <div className={cn('space-y-4', className)}>
        {blocks.map((block) => {
          const Icon = TYPE_ICONS[block.block_type];
          
          return (
            <Card 
              key={block.id}
              className={cn('border', TYPE_STYLES[block.block_type])}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-white rounded shrink-0">
                    <Icon className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-800">{block.title}</h4>
                    {renderBody(block.body)}
                    
                    {block.cta_text && block.cta_link && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 mt-3"
                        onClick={() => handleCtaClick(block)}
                      >
                        {block.cta_text}
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // Inline layout (for simple callouts)
  return (
    <div className={cn('space-y-3', className)}>
      {blocks.map((block) => {
        const Icon = TYPE_ICONS[block.block_type];
        
        return (
          <div
            key={block.id}
            className={cn('p-3 rounded-lg border text-sm', TYPE_STYLES[block.block_type])}
          >
            <div className="flex items-start gap-2">
              <Icon className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-medium text-slate-800">{block.title}</span>
                {block.body && (
                  <span className="text-slate-600 ml-1">{block.body}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
