/**
 * Related Questions Component - Professional Design
 * Displays clickable related/follow-up questions
 */

import { ArrowRight, Lightbulb } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { RelatedQuestionResult } from '@/lib/practice';

interface RelatedQuestionsProps {
  relatedQuestions: RelatedQuestionResult[];
  onQuestionClick: (result: RelatedQuestionResult) => void;
  className?: string;
}

const reasonLabels: Record<RelatedQuestionResult['reason'], string> = {
  'explicit': 'Follow-up',
  'same-topic': 'Related',
  'same-category': 'Similar topic',
  'fallback': 'You might also consider',
};

const relatedThemes = [
  {
    card: 'border-blue-200 bg-gradient-to-br from-white to-blue-50 hover:border-blue-400 hover:shadow-blue-100',
    marker: 'bg-blue-600 text-white shadow-blue-200',
    arrow: 'text-blue-600 group-hover:text-blue-800',
  },
  {
    card: 'border-amber-200 bg-gradient-to-br from-white to-amber-50 hover:border-amber-400 hover:shadow-amber-100',
    marker: 'bg-amber-500 text-white shadow-amber-200',
    arrow: 'text-amber-600 group-hover:text-amber-800',
  },
  {
    card: 'border-emerald-200 bg-gradient-to-br from-white to-emerald-50 hover:border-emerald-400 hover:shadow-emerald-100',
    marker: 'bg-emerald-600 text-white shadow-emerald-200',
    arrow: 'text-emerald-600 group-hover:text-emerald-800',
  },
];

export function RelatedQuestions({
  relatedQuestions,
  onQuestionClick,
  className,
}: RelatedQuestionsProps) {
  // Don't render if no related questions (graceful hide)
  if (!relatedQuestions || relatedQuestions.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2 text-slate-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Lightbulb className="h-4 w-4" />
        </span>
        <h4 className="text-sm font-extrabold">Related questions to consider</h4>
      </div>

      <div className="space-y-2">
        {relatedQuestions.map((result, index) => (
          <RelatedQuestionCard
            key={result.question.id}
            result={result}
            index={index}
            onClick={() => onQuestionClick(result)}
          />
        ))}
      </div>
    </div>
  );
}

interface RelatedQuestionCardProps {
  result: RelatedQuestionResult;
  index: number;
  onClick: () => void;
}

function RelatedQuestionCard({ result, index, onClick }: RelatedQuestionCardProps) {
  const { question, topicTitle, reason } = result;
  const theme = relatedThemes[index % relatedThemes.length];
  
  return (
    <Card 
      onClick={onClick}
      className={cn(
        'group cursor-pointer border-2 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg',
        theme.card
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-extrabold shadow-md transition-colors', theme.marker)}>
            {index + 1}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-relaxed text-slate-950">
              {question.prompt}
            </p>
            
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-bold text-slate-700">
                {topicTitle}
              </span>
              <span className="text-slate-500">-</span>
              <span className="text-xs font-bold text-blue-700">
                {reasonLabels[reason]}
              </span>
            </div>
          </div>
          
          <ArrowRight className={cn('mt-0.5 h-4 w-4 flex-shrink-0 transition-all group-hover:translate-x-0.5', theme.arrow)} />
        </div>
      </CardContent>
    </Card>
  );
}
