/**
 * Celebration Message
 * 
 * Displays subtle positive feedback messages after practice activities.
 * Auto-dismisses after a delay.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { CheckCircle2, Sparkles, TrendingUp, Flame, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CelebrationType = 
  | 'practice-complete'
  | 'streak-increase'
  | 'readiness-improved'
  | 'topic-complete'
  | 'milestone-reached';

interface CelebrationMessageProps {
  type: CelebrationType;
  message?: string;
  detail?: string;
  isVisible: boolean;
  onDismiss?: () => void;
  autoDismissDelay?: number; // milliseconds
  className?: string;
}

const DEFAULT_MESSAGES: Record<CelebrationType, { title: string; icon: typeof CheckCircle2 }> = {
  'practice-complete': { title: 'Nice progress today.', icon: CheckCircle2 },
  'streak-increase': { title: 'Streak continued!', icon: Flame },
  'readiness-improved': { title: 'Your readiness improved.', icon: TrendingUp },
  'topic-complete': { title: 'Topic completed!', icon: Sparkles },
  'milestone-reached': { title: 'Milestone reached!', icon: Sparkles },
};

export function CelebrationMessage({
  type,
  message,
  detail,
  isVisible,
  onDismiss,
  autoDismissDelay = 5000,
  className,
}: CelebrationMessageProps) {
  const [isShowing, setIsShowing] = useState(false);
  const { title, icon: Icon } = DEFAULT_MESSAGES[type];

  useEffect(() => {
    if (isVisible) {
      // Small delay for entrance animation
      const showTimer = setTimeout(() => setIsShowing(true), 50);
      
      // Auto dismiss
      const dismissTimer = setTimeout(() => {
        setIsShowing(false);
        setTimeout(() => onDismiss?.(), 300); // Wait for exit animation
      }, autoDismissDelay);

      return () => {
        clearTimeout(showTimer);
        clearTimeout(dismissTimer);
      };
    } else {
      setIsShowing(false);
    }
  }, [isVisible, autoDismissDelay, onDismiss]);

  if (!isVisible) return null;

  const getIconColor = () => {
    switch (type) {
      case 'streak-increase':
        return 'text-amber-500';
      case 'readiness-improved':
        return 'text-blue-500';
      case 'topic-complete':
      case 'milestone-reached':
        return 'text-purple-500';
      default:
        return 'text-emerald-500';
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'streak-increase':
        return 'bg-amber-50 border-amber-200';
      case 'readiness-improved':
        return 'bg-blue-50 border-blue-200';
      case 'topic-complete':
      case 'milestone-reached':
        return 'bg-purple-50 border-purple-200';
      default:
        return 'bg-emerald-50 border-emerald-200';
    }
  };

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 max-w-sm transition-all duration-300 ease-out',
        isShowing ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        className
      )}
    >
      <div className={cn(
        'rounded-xl border p-4 shadow-lg',
        getBgColor()
      )}>
        <div className="flex items-start gap-3">
          <div className={cn('mt-0.5', getIconColor())}>
            <Icon className="w-5 h-5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-800">
              {message || title}
            </p>
            {detail && (
              <p className="text-sm text-slate-600 mt-0.5">
                {detail}
              </p>
            )}
          </div>

          {onDismiss && (
            <button
              onClick={() => {
                setIsShowing(false);
                setTimeout(() => onDismiss(), 300);
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for managing celebration messages
 * Usage:
 * const { celebration, showCelebration, dismissCelebration, CelebrationComponent } = useCelebration();
 * 
 * // In JSX:
 * {CelebrationComponent}
 * 
 * // To trigger:
 * showCelebration('practice-complete', 'Nice work!', 'You practiced 5 questions');
 */
export function useCelebration() {
  const [celebration, setCelebration] = useState<{
    type: CelebrationType;
    message?: string;
    detail?: string;
    key: number; // Used to force re-render for duplicate messages
  } | null>(null);

  const showCelebration = useCallback((type: CelebrationType, message?: string, detail?: string) => {
    setCelebration(prev => ({ 
      type, 
      message, 
      detail, 
      key: (prev?.key || 0) + 1 // Increment key to ensure animation plays for duplicate messages
    }));
  }, []);

  const dismissCelebration = useCallback(() => {
    setCelebration(null);
  }, []);

  // Memoize the component to prevent unnecessary re-renders
  const CelebrationComponent = useMemo(() => {
    if (!celebration) return null;
    
    return (
      <CelebrationMessage
        key={celebration.key}
        type={celebration.type}
        message={celebration.message}
        detail={celebration.detail}
        isVisible={true}
        onDismiss={dismissCelebration}
      />
    );
  }, [celebration, dismissCelebration]);

  return {
    celebration,
    showCelebration,
    dismissCelebration,
    CelebrationComponent,
  };
}

export default CelebrationMessage;
