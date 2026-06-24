/**
 * Today's Progress Card
 * 
 * Shows today's practice activity summary.
 */

import { Calendar, CheckCircle2, MessageSquare, BookOpen, Sparkles, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TodayProgress {
  questionsReviewed: number;
  followUpQuestionsAnswered: number;
  topicsRevisited: number;
  aiInterviewTurns: number;
}

interface TodayProgressCardProps {
  progress?: TodayProgress;
  className?: string;
  onStartPractice?: () => void;
}

export function TodayProgressCard({
  progress,
  className,
  onStartPractice,
}: TodayProgressCardProps) {
  const hasActivity = progress && (
    progress.questionsReviewed > 0 ||
    progress.followUpQuestionsAnswered > 0 ||
    progress.topicsRevisited > 0 ||
    progress.aiInterviewTurns > 0
  );

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 p-5', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-800">Today's Practice</h3>
        </div>
        <span className="text-xs text-slate-500">{today}</span>
      </div>

      {hasActivity ? (
        <div className="space-y-3">
          {progress!.questionsReviewed > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-slate-600">
                <span className="font-semibold text-slate-800">{progress!.questionsReviewed}</span> questions reviewed
              </span>
            </div>
          )}

          {progress!.aiInterviewTurns > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-slate-600">
                <span className="font-semibold text-slate-800">{progress!.aiInterviewTurns}</span> AI interview exchanges
              </span>
            </div>
          )}

          {progress!.topicsRevisited > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-slate-600">
                <span className="font-semibold text-slate-800">{progress!.topicsRevisited}</span> topics revisited
              </span>
            </div>
          )}

          {/* Encouragement */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-sm text-slate-600">
              {progress!.questionsReviewed < 5 
                ? "Good start today! Keep building momentum."
                : progress!.questionsReviewed < 15
                ? "Nice progress today! You're building confidence."
                : "Excellent work today! You're making great strides."}
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <Target className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-600 text-sm mb-1">
            No practice yet today
          </p>
          <p className="text-slate-500 text-xs mb-4">
            Start practicing with Robin to build your readiness
          </p>
          {onStartPractice && (
            <button
              onClick={onStartPractice}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Start Practicing
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default TodayProgressCard;
