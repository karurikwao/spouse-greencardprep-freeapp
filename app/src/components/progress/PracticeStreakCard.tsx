/**
 * Practice Streak Card
 * 
 * Displays the user's current practice streak with encouraging messaging.
 */

import { Flame, Zap, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PracticeStreakCardProps {
  currentStreak: number;
  longestStreak?: number;
  className?: string;
}

export function PracticeStreakCard({
  currentStreak,
  longestStreak,
  className,
}: PracticeStreakCardProps) {
  const isNewStreak = currentStreak === 0;
  const isLongStreak = currentStreak >= 7;
  const isRecordStreak = longestStreak !== undefined && currentStreak >= longestStreak && currentStreak > 0;

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 p-5', className)}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">Practice Streak</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {isNewStreak 
              ? "Start your practice streak today."
              : "Practicing regularly improves interview confidence."}
          </p>
        </div>
        
        {/* Streak indicator */}
        <div className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
          isNewStreak 
            ? 'bg-slate-100 text-slate-600' 
            : isLongStreak 
            ? 'bg-orange-100 text-orange-700'
            : 'bg-amber-100 text-amber-700'
        )}>
          {isNewStreak ? (
            <Zap className="w-4 h-4" />
          ) : isLongStreak ? (
            <Trophy className="w-4 h-4" />
          ) : (
            <Flame className="w-4 h-4" />
          )}
          <span>
            {currentStreak > 0 ? `${currentStreak} day${currentStreak !== 1 ? 's' : ''}` : 'Start'}
          </span>
        </div>
      </div>

      {/* Progress visualization for active streak */}
      {currentStreak > 0 && (
        <div className="mt-4">
          <div className="flex gap-1">
            {Array.from({ length: Math.min(currentStreak, 7) }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-2 flex-1 rounded-full transition-all duration-500',
                  isLongStreak ? 'bg-orange-500' : 'bg-amber-500'
                )}
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
            {currentStreak < 7 && (
              <div className="h-2 flex-1 rounded-full bg-slate-100" />
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {isRecordStreak 
              ? "This is your longest streak! Keep it up."
              : currentStreak < 3 
              ? "Practice tomorrow to continue your streak."
              : `You're on a roll. ${7 - (currentStreak % 7)} more days until your next milestone.`}
          </p>
        </div>
      )}

      {/* Empty state encouragement */}
      {isNewStreak && (
        <div className="mt-4 p-3 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-600">
            Practicing a few questions each day helps build lasting confidence for your interview.
          </p>
        </div>
      )}
    </div>
  );
}

export default PracticeStreakCard;
