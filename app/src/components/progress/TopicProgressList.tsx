/**
 * Topic Progress List
 * 
 * Displays progress for each interview topic with progress bars.
 */

import { BookOpen, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TopicProgress {
  id: string;
  name: string;
  progress: number; // 0-100
  totalQuestions: number;
  completedQuestions: number;
}

interface TopicProgressListProps {
  topics: TopicProgress[];
  className?: string;
  maxDisplay?: number;
}

export function TopicProgressList({
  topics,
  className,
  maxDisplay = 6,
}: TopicProgressListProps) {
  // Sort by progress (highest first), then by name
  const sortedTopics = [...topics]
    .sort((a, b) => {
      if (b.progress !== a.progress) return b.progress - a.progress;
      return a.name.localeCompare(b.name);
    })
    .slice(0, maxDisplay);

  const hasProgress = sortedTopics.some(t => t.progress > 0);

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 p-5', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-800">Topic Progress</h3>
        </div>
        {hasProgress && (
          <span className="text-xs text-slate-500">
            {topics.filter(t => t.progress > 0).length} of {topics.length} started
          </span>
        )}
      </div>

      <div className="space-y-4">
        {sortedTopics.map((topic) => (
          <div key={topic.id} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className={cn(
                'font-medium',
                topic.progress > 0 ? 'text-slate-700' : 'text-slate-400'
              )}>
                {topic.name}
              </span>
              <div className="flex items-center gap-2">
                {topic.progress === 100 && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                )}
                <span className={cn(
                  'text-xs font-medium',
                  topic.progress > 0 ? 'text-slate-600' : 'text-slate-400'
                )}>
                  {topic.progress}%
                </span>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700 ease-out',
                  topic.progress === 100 
                    ? 'bg-emerald-500' 
                    : topic.progress >= 50 
                    ? 'bg-blue-500' 
                    : topic.progress > 0 
                    ? 'bg-amber-500'
                    : 'bg-slate-200'
                )}
                style={{ 
                  width: `${Math.max(0, Math.min(100, Number(topic.progress) || 0))}%`,
                  transitionDelay: '100ms'
                }}
              />
            </div>
            
            {/* Question count */}
            <p className="text-xs text-slate-400">
              {topic.completedQuestions} of {topic.totalQuestions} questions
              {topic.progress === 100 && ' • Completed'}
            </p>
          </div>
        ))}
      </div>

      {!hasProgress && (
        <div className="mt-4 p-3 bg-slate-50 rounded-lg text-center">
          <p className="text-sm text-slate-500">
            Start practicing to see your topic progress.
          </p>
        </div>
      )}

      {topics.length > maxDisplay && (
        <p className="text-xs text-slate-400 text-center mt-4">
          Showing top {maxDisplay} topics
        </p>
      )}
    </div>
  );
}

export default TopicProgressList;
