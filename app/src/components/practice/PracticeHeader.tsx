/**
 * Practice Header Component - Professional, Calm Design
 * Shows topic title, description, and progress
 */

import { ArrowLeft, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SecurePDFDownload } from '@/components/paywall';
import type { PracticeTopic } from '@/lib/practice';

interface PracticeHeaderProps {
  topic: PracticeTopic;
  currentQuestionIndex: number;
  totalQuestions: number;
  onBack: () => void;
  onOpenChecklist?: () => void;
  className?: string;
}

export function PracticeHeader({
  topic,
  currentQuestionIndex,
  totalQuestions,
  onBack,
  onOpenChecklist,
  className,
}: PracticeHeaderProps) {
  const progress = Math.round((currentQuestionIndex / totalQuestions) * 100);

  return (
    <div className={cn('sticky top-0 z-10 border-b border-blue-100 bg-white/95 shadow-sm shadow-blue-100/60 backdrop-blur', className)}>
      <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mb-4 -ml-2 font-bold text-blue-800 hover:bg-blue-50 hover:text-blue-950"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Topics
        </Button>

        {/* Title Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold leading-tight text-slate-950">
              {topic.title}
            </h1>
            <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-700">
              {topic.description}
            </p>
          </div>

          {/* Desktop Actions */}
          <div className="hidden sm:flex items-center gap-2">
            {onOpenChecklist && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenChecklist}
                className="border-blue-200 bg-white font-bold text-blue-800 shadow-sm hover:border-blue-400 hover:bg-blue-50"
              >
                <CheckSquare className="w-4 h-4 mr-1.5" />
                Checklist
              </Button>
            )}
            {/* SECURE PDF DOWNLOAD - Uses Supabase private storage + signed URLs */}
            <SecurePDFDownload
              pdfFileName={topic.pdfFileName}
              pdfTitle={topic.title}
              topicId={topic.id}
              categoryId={topic.categoryId}
              source="practice_mode"
              variant="button"
              size="sm"
              className="border-amber-300 bg-amber-50 font-bold text-amber-800 shadow-sm hover:border-amber-500 hover:bg-amber-100"
              label="PDF"
            />
          </div>
        </div>

        {/* Progress Bar - Minimal */}
        <div className="mt-5 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-blue-100">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-xs font-extrabold text-blue-800">
            {currentQuestionIndex + 1} of {totalQuestions}
          </span>
        </div>

        {/* Mobile Actions */}
        <div className="flex sm:hidden gap-2 mt-4">
          {onOpenChecklist && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenChecklist}
              className="flex-1 border-blue-200 bg-white font-bold text-blue-800 hover:border-blue-400 hover:bg-blue-50"
            >
              <CheckSquare className="w-4 h-4 mr-1.5" />
              Checklist
            </Button>
          )}
          {/* SECURE PDF DOWNLOAD - Mobile */}
          <SecurePDFDownload
            pdfFileName={topic.pdfFileName}
            pdfTitle={topic.title}
            topicId={topic.id}
            categoryId={topic.categoryId}
            source="practice_mode"
            variant="button"
            size="sm"
            className="flex-1 border-amber-300 bg-amber-50 font-bold text-amber-800 hover:border-amber-500 hover:bg-amber-100"
            label="PDF"
          />
        </div>
      </div>
    </div>
  );
}
