/**
 * Readiness Score Card
 * 
 * Displays the user's interview readiness percentage.
 * Simple estimation based on questions practiced and topics reviewed.
 */

import { Target, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ReadinessScoreCardProps {
  score: number; // 0-100
  questionsPracticed?: number;
  totalQuestions?: number;
  className?: string;
  showFreeBadge?: boolean;
}

export function ReadinessScoreCard({
  score,
  questionsPracticed = 0,
  totalQuestions = 100,
  className,
  showFreeBadge = true,
}: ReadinessScoreCardProps) {
  // Validate and clamp score to valid range
  const validScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const validQuestionsPracticed = Math.max(0, Math.round(Number(questionsPracticed) || 0));
  const validTotalQuestions = Math.max(1, Math.round(Number(totalQuestions) || 100));

  // Determine readiness level
  const getLevel = (s: number) => {
    if (s >= 80) return { label: 'Well Prepared', color: 'text-emerald-600', bgColor: 'bg-emerald-50' };
    if (s >= 50) return { label: 'Getting There', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    if (s >= 20) return { label: 'Building Foundation', color: 'text-amber-600', bgColor: 'bg-amber-50' };
    return { label: 'Just Starting', color: 'text-slate-600', bgColor: 'bg-slate-50' };
  };

  const level = getLevel(validScore);

  // Calculate ring circumference
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (validScore / 100) * circumference;

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 p-5', className)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-800">Interview Readiness</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Your readiness increases as you review topics and practice questions
          </p>
        </div>
        {showFreeBadge && (
          <Badge variant="secondary" className="text-xs">
            <Sparkles className="w-3 h-3 mr-1" />
            Free
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-6">
        {/* Score Ring */}
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
            {/* Background ring */}
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="8"
            />
            {/* Progress ring */}
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={cn('transition-all duration-1000', level.color)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-2xl font-bold', level.color)}>{validScore}%</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">Ready</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-3">
          <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium', level.bgColor, level.color)}>
            <Target className="w-4 h-4" />
            {level.label}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Questions practiced</span>
              <span className="font-medium text-slate-800">
                {validQuestionsPracticed} / {validTotalQuestions}
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', 
                  validScore >= 80 ? 'bg-emerald-500' : 
                  validScore >= 50 ? 'bg-blue-500' : 
                  'bg-amber-500'
                )}
                style={{ width: `${Math.min(100, (validQuestionsPracticed / validTotalQuestions) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Encouragement message */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-sm text-slate-600">
          {validScore < 30 && "Start practicing with Robin to build your foundation."}
          {validScore >= 30 && validScore < 60 && "You're building good momentum. Keep practicing!"}
          {validScore >= 60 && validScore < 80 && "Great progress! You're approaching interview readiness."}
          {validScore >= 80 && "Excellent! You're well prepared for your interview."}
        </p>
      </div>
    </div>
  );
}

export default ReadinessScoreCard;
