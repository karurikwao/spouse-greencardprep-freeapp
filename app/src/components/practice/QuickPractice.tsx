/**
 * Quick Practice Mode
 * 10-minute practice session with 5 important questions
 */

import { useState, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { QuestionCard } from './QuestionCard';
import { ComfortActions } from './ComfortActions';
import { normalizeAllTopics } from '@/lib/practice/normalize';
import { topics } from '@/data/topics';
import { usePractice } from '@/lib/practice';
import type { ComfortStatus } from '@/lib/practice/types';

interface QuickPracticeProps {
  onBack: () => void;
}

export function QuickPractice({ onBack }: QuickPracticeProps) {
  const normalizedTopics = useMemo(() => normalizeAllTopics(topics), []);
  const { getComfortStatus, setComfortStatus, toggleSaveForLater, isSavedForLater } = usePractice();

  // Select 5 important questions from different topics
  const selectedQuestions = useMemo(() => {
    const importantTopics = [
      'relationship-timeline',
      'daily-routine', 
      'kitchen-household',
      'bedroom',
      'money-bills'
    ];
    
    const questions: { question: ReturnType<typeof normalizeAllTopics>[0]['questions'][0]; topicId: string; categoryId: string }[] = [];
    
    importantTopics.forEach(topicId => {
      const topic = normalizedTopics.find(t => t.id === topicId);
      if (topic && topic.questions.length > 0) {
        // Pick first question from each topic
        questions.push({
          question: topic.questions[0],
          topicId: topic.id,
          categoryId: topic.categoryId,
        });
      }
    });
    
    return questions;
  }, [normalizedTopics]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState(false);

  const currentQ = selectedQuestions[currentIndex];
  const progress = ((currentIndex + 1) / selectedQuestions.length) * 100;

  const handleNext = () => {
    if (currentIndex < selectedQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCompleted(true);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (completed) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-slate-800 mb-2">Quick Practice Complete!</h2>
            <p className="text-slate-500 mb-6">
              You reviewed {selectedQuestions.length} important questions. 
              Great job fitting practice into your busy day.
            </p>
            <Button onClick={onBack} className="bg-slate-700 hover:bg-slate-800">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentQ) {
    return null;
  }

  const comfortStatus = getComfortStatus(currentQ.question.id);
  const savedStatus = isSavedForLater(currentQ.question.id);

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/60 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Exit
            </Button>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock className="w-4 h-4" />
              Quick Practice
            </div>
          </div>
          <Progress value={progress} className="mt-3 h-1.5" />
        </div>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="space-y-6">
          <QuestionCard
            question={currentQ.question}
            questionNumber={currentIndex + 1}
            totalQuestions={selectedQuestions.length}
          />

          <Card className="border-slate-200/60">
            <CardContent className="p-5">
              <ComfortActions
                comfortStatus={comfortStatus}
                isSavedForLater={savedStatus}
                onComfortChange={(status: ComfortStatus) => setComfortStatus(currentQ.question.id, status)}
                onSaveToggle={() => toggleSaveForLater(currentQ.question.id)}
              />
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              onClick={handleNext}
              className="bg-slate-700 hover:bg-slate-800"
            >
              {currentIndex < selectedQuestions.length - 1 ? (
                <>
                  Next
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              ) : (
                'Finish'
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
