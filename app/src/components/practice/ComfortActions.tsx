/**
 * Comfort Actions Component - Calm, Professional Design
 * Allows users to mark their comfort level with a question
 */

import { useEffect, useState } from 'react';
import { CheckCircle, RefreshCw, AlertCircle, Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ComfortStatus } from '@/lib/practice';

interface ComfortActionsProps {
  comfortStatus: ComfortStatus;
  isSavedForLater: boolean;
  onComfortChange: (status: ComfortStatus) => void;
  onSaveToggle: () => void;
  className?: string;
}

const comfortOptions: { 
  value: ComfortStatus; 
  label: string; 
  description: string;
  icon: typeof CheckCircle;
  colors: string;
  selectedColors: string;
  iconColors: string;
}[] = [
  {
    value: 'understood',
    label: 'Comfortable',
    description: 'I can answer this confidently',
    icon: CheckCircle,
    colors: 'bg-gradient-to-br from-white to-emerald-50/70 border-emerald-200 text-emerald-950 hover:border-emerald-400 hover:shadow-md hover:shadow-emerald-100',
    selectedColors: 'bg-gradient-to-br from-emerald-100 to-white border-emerald-500 text-emerald-950 shadow-lg shadow-emerald-100 ring-2 ring-emerald-200',
    iconColors: 'bg-emerald-600 text-white shadow-emerald-200',
  },
  {
    value: 'needs-practice',
    label: 'Needs review',
    description: 'I want to practice this more',
    icon: RefreshCw,
    colors: 'bg-gradient-to-br from-white to-amber-50/80 border-amber-200 text-amber-950 hover:border-amber-400 hover:shadow-md hover:shadow-amber-100',
    selectedColors: 'bg-gradient-to-br from-amber-100 to-white border-amber-500 text-amber-950 shadow-lg shadow-amber-100 ring-2 ring-amber-200',
    iconColors: 'bg-amber-500 text-white shadow-amber-200',
  },
  {
    value: 'nervous',
    label: 'Unsure',
    description: 'This question feels difficult',
    icon: AlertCircle,
    colors: 'bg-gradient-to-br from-white to-rose-50/80 border-rose-200 text-rose-950 hover:border-rose-400 hover:shadow-md hover:shadow-rose-100',
    selectedColors: 'bg-gradient-to-br from-rose-100 to-white border-rose-500 text-rose-950 shadow-lg shadow-rose-100 ring-2 ring-rose-200',
    iconColors: 'bg-rose-600 text-white shadow-rose-200',
  },
];

export function ComfortActions({
  comfortStatus,
  isSavedForLater,
  onComfortChange,
  onSaveToggle,
  className,
}: ComfortActionsProps) {
  const SaveIcon = isSavedForLater ? BookmarkCheck : Bookmark;
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);

  useEffect(() => {
    if (!showSavedConfirmation) return;

    const timer = window.setTimeout(() => {
      setShowSavedConfirmation(false);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [showSavedConfirmation]);

  const handleSaveClick = () => {
    const willSave = !isSavedForLater;
    onSaveToggle();
    setShowSavedConfirmation(willSave);
  };

  return (
    <div className={cn('space-y-5', className)}>
      <div>
        <div className="mb-1 text-sm font-extrabold text-slate-950">
          How comfortable are you with this question?
        </div>
        <div className="text-xs font-bold text-blue-800">
          Track your confidence to focus your study time
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {comfortOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = comfortStatus === option.value;
          
          return (
            <button
              key={option.value}
              onClick={() => onComfortChange(isSelected ? null : option.value)}
              className={cn(
                'relative flex flex-col items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                isSelected ? option.selectedColors : option.colors
              )}
            >
              <span className={cn('flex h-8 w-8 items-center justify-center rounded-full shadow-md', option.iconColors)}>
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-extrabold">{option.label}</div>
                <div className={cn(
                  'mt-0.5 text-xs font-semibold',
                  isSelected ? 'opacity-95' : 'text-slate-700'
                )}>
                  {option.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleSaveClick}
        className={cn(
          'rounded-full border-2 px-4 font-extrabold shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
          isSavedForLater
            ? 'border-blue-300 bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-blue-200 hover:from-blue-700 hover:to-cyan-700 hover:text-white'
            : 'border-blue-100 bg-white text-blue-800 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-950 hover:shadow-blue-100'
        )}
      >
        <SaveIcon className="w-4 h-4 mr-2" />
        {isSavedForLater ? 'Saved to review later' : 'Save to review later'}
      </Button>
      {showSavedConfirmation && (
        <div
          role="status"
          className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-extrabold text-emerald-800 shadow-sm shadow-emerald-100"
        >
          <BookmarkCheck className="h-4 w-4" />
          Saved for review. Find it in your dashboard under Saved for Later.
        </div>
      )}
    </div>
  );
}
