/**
 * Stress Review Page
 * Shows questions marked as difficult/nervous
 */

import { useMemo } from 'react';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { normalizeAllTopics } from '@/lib/practice/normalize';
import { topics } from '@/data/topics';
import { usePractice } from '@/lib/practice';

interface StressReviewPageProps {
  onBack: () => void;
  onPracticeQuestion: (topicId: string, questionIndex: number) => void;
}

export function StressReviewPage({ onBack, onPracticeQuestion }: StressReviewPageProps) {
  const normalizedTopics = useMemo(() => normalizeAllTopics(topics), []);
  const { getComfortStatus } = usePractice();

  // Get all questions marked as nervous
  const nervousQuestions = useMemo(() => {
    const questions: { 
      topicId: string; 
      questionId: string; 
      prompt: string;
      topicTitle: string;
      index: number;
    }[] = [];
    
    normalizedTopics.forEach(topic => {
      topic.questions.forEach((q, idx) => {
        if (getComfortStatus(q.id) === 'nervous') {
          questions.push({
            topicId: topic.id,
            questionId: q.id,
            prompt: q.prompt,
            topicTitle: topic.title,
            index: idx,
          });
        }
      });
    });
    
    return questions;
  }, [normalizedTopics, getComfortStatus]);

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/60 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          
          <div className="mt-4 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-500" />
            <div>
              <h1 className="text-xl font-medium text-slate-800">Topics to Review Gently</h1>
              <p className="text-sm text-slate-500">
                {nervousQuestions.length} question{nervousQuestions.length !== 1 ? 's' : ''} marked as needing more attention
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {nervousQuestions.length === 0 ? (
          <Card className="border-slate-200/60">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h2 className="text-lg font-medium text-slate-800 mb-2">No questions marked yet</h2>
              <p className="text-slate-500">
                While practicing, mark questions as &ldquo;This makes me nervous&rdquo; to see them here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {nervousQuestions.map((q, idx) => (
              <Card 
                key={idx} 
                className="border-slate-200/60 hover:border-rose-200 transition-colors cursor-pointer"
                onClick={() => onPracticeQuestion(q.topicId, q.index)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm text-rose-500">{idx + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-700 font-medium">{q.prompt}</p>
                      <p className="text-sm text-slate-400 mt-1">{q.topicTitle}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
