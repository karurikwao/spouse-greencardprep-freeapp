/**
 * Question Card Component - Professional, Calm Design
 * Displays a single practice question with reveal-answer interaction
 */

import { useState } from 'react';
import { Eye, EyeOff, MessageSquare, Sparkles, AlertTriangle, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PracticeQuestion } from '@/lib/practice';

interface QuestionCardProps {
  question: PracticeQuestion;
  questionNumber: number;
  totalQuestions: number;
  className?: string;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  className,
}: QuestionCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  const hasGuidance = question.tip || question.officerLookingFor || question.avoidThis;
  const progress = (questionNumber / totalQuestions) * 100;

  return (
    <Card className={cn('overflow-hidden border-2 border-blue-100 bg-gradient-to-br from-white via-blue-50/40 to-amber-50/30 shadow-xl shadow-slate-200/80', className)}>
      {/* Progress Header */}
      <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-amber-50 px-5 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wide text-blue-800">
            Question {questionNumber} of {totalQuestions}
          </span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-blue-100">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <CardContent className="p-6 sm:p-8">
        {/* Question Prompt */}
        <div className="mb-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-200">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="flex-1 pt-1">
              <h3 className="text-xl font-semibold leading-relaxed text-slate-950 sm:text-2xl">
                {question.prompt}
              </h3>
            </div>
          </div>
        </div>

        {/* Reveal Answer Button - Calm, inviting */}
        {!isRevealed && (
          <Button
            onClick={() => setIsRevealed(true)}
            variant="outline"
            className="group w-full border-0 bg-gradient-to-r from-blue-600 to-cyan-600 py-6 text-base font-bold text-white shadow-lg shadow-blue-200 transition-all hover:from-blue-700 hover:to-cyan-700 hover:text-white"
          >
            <Eye className="mr-2 h-4 w-4 text-white" />
            View suggested response
          </Button>
        )}

        {/* Revealed Answer Section */}
        {isRevealed && (
          <div className="space-y-5 animate-in fade-in duration-500">
            {/* Sample Answer - Calm, professional */}
            {question.sampleAnswer && (
              <div className="rounded-xl border-2 border-blue-100 bg-gradient-to-br from-blue-50 via-white to-amber-50 p-6 shadow-inner">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-extrabold text-blue-900">
                    One way to respond
                  </span>
                </div>
                <blockquote className="border-l-4 border-blue-500 pl-4 font-medium leading-8 text-slate-950">
                  {question.sampleAnswer}
                </blockquote>
                <p className="mt-4 text-xs font-bold text-blue-800">
                  Adapt this to match your own experience and speaking style.
                </p>
              </div>
            )}

            {/* Guidance Blocks - Muted colors */}
            {hasGuidance && (
              <div className="space-y-3 pt-2">
                {question.tip && (
                  <GuidanceBlock 
                    type="tip"
                    content={question.tip}
                  />
                )}
                {question.officerLookingFor && (
                  <GuidanceBlock 
                    type="looking-for"
                    content={question.officerLookingFor}
                  />
                )}
                {question.avoidThis && (
                  <GuidanceBlock 
                    type="avoid"
                    content={question.avoidThis}
                  />
                )}
              </div>
            )}

            {/* Hide Answer Button - Subtle */}
            <Button
              onClick={() => setIsRevealed(false)}
              variant="ghost"
              size="sm"
              className="font-semibold text-blue-700 hover:bg-blue-50 hover:text-blue-900"
            >
              <EyeOff className="w-4 h-4 mr-2" />
              Hide response
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface GuidanceBlockProps {
  type: 'tip' | 'looking-for' | 'avoid';
  content: string;
}

function GuidanceBlock({ type, content }: GuidanceBlockProps) {
  const configs = {
    tip: {
      icon: Sparkles,
      label: 'Helpful context',
      colors: 'bg-amber-50/50 border-amber-100 text-amber-900',
      iconColor: 'text-amber-700',
    },
    'looking-for': {
      icon: Shield,
      label: 'What helps your case',
      colors: 'bg-emerald-50/50 border-emerald-100 text-emerald-900',
      iconColor: 'text-emerald-700',
    },
    avoid: {
      icon: AlertTriangle,
      label: 'Consider adding more detail',
      colors: 'bg-rose-50/50 border-rose-100 text-rose-900',
      iconColor: 'text-rose-700',
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <div className={cn('rounded-lg border p-4', config.colors)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', config.iconColor)} />
        <div>
          <div className="text-xs font-semibold mb-1">{config.label}</div>
          <p className="text-sm leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  );
}
