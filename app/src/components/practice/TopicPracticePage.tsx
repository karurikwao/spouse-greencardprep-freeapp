/**
 * Topic Practice Page - Professional, Calm Design
 * Main practice interface showing one question at a time
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, List, CheckCircle, X, UserPlus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useOptionalAuth } from '@/lib/auth/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { AdPlacement } from '@/components/ads';
import { SecurePDFDownload } from '@/components/paywall';
import { 
  usePractice, 
  getRelatedQuestions, 
  hasRelatedQuestions,
  type PracticeTopic,
  type RelatedQuestionResult,
} from '@/lib/practice';
import { PracticeHeader } from './PracticeHeader';
import { QuestionCard } from './QuestionCard';
import { ComfortActions } from './ComfortActions';
import { RelatedQuestions } from './RelatedQuestions';
import type { ComfortStatus } from '@/lib/practice';

interface TopicPracticePageProps {
  topic: PracticeTopic;
  allTopics: PracticeTopic[];
  onBack: () => void;
  onSelectQuestion?: (topicId: string, questionIndex: number) => void;
}

export function TopicPracticePage({
  topic,
  allTopics,
  onBack,
  onSelectQuestion,
}: TopicPracticePageProps) {
  const {
    getCurrentIndex,
    setCurrentIndex,
    getComfortStatus,
    setComfortStatus,
    isSavedForLater,
    toggleSaveForLater,
  } = usePractice();
  const { isAuthenticated } = useOptionalAuth();
  const questionSectionRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToQuestionRef = useRef(false);

  // Get persisted index or start at 0
  const [currentIndex, setLocalIndex] = useState(() => getCurrentIndex(topic.id));
  const [isQuestionListOpen, setIsQuestionListOpen] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // Sync with persistence when index changes
  useEffect(() => {
    setCurrentIndex(topic.id, currentIndex);
  }, [currentIndex, topic.id, setCurrentIndex]);

  useEffect(() => {
    if (!shouldScrollToQuestionRef.current) return;
    shouldScrollToQuestionRef.current = false;

    const scrollTimer = window.setTimeout(() => {
      questionSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 50);

    return () => window.clearTimeout(scrollTimer);
  }, [currentIndex]);

  const currentQuestion = topic.questions[currentIndex];
  const totalQuestions = topic.questions.length;

  // Get related questions for current question
  const relatedQuestions = useMemo(() => {
    if (!currentQuestion) return [];
    return getRelatedQuestions({
      currentQuestion,
      currentTopic: topic,
      allTopics,
      maxItems: 4,
      excludeCurrent: true,
    });
  }, [currentQuestion, topic, allTopics]);

  // Check if we have related questions to show
  const hasRelated = useMemo(() => {
    if (!currentQuestion) return false;
    return hasRelatedQuestions(currentQuestion, topic, allTopics, 1);
  }, [currentQuestion, topic, allTopics]);

  // Navigation handlers
  const currentTopicIndex = useMemo(
    () => allTopics.findIndex((candidate) => candidate.id === topic.id),
    [allTopics, topic.id]
  );
  const nextTopic = currentTopicIndex >= 0 ? allTopics[currentTopicIndex + 1] : undefined;
  const canMoveToNextTopic = Boolean(nextTopic && onSelectQuestion);
  const isAtLastQuestion = currentIndex >= totalQuestions - 1;

  const goToNext = useCallback(() => {
    if (currentIndex < totalQuestions - 1) {
      shouldScrollToQuestionRef.current = true;
      setLocalIndex(prev => prev + 1);
      return;
    }

    if (nextTopic && onSelectQuestion) {
      shouldScrollToQuestionRef.current = true;
      onSelectQuestion(nextTopic.id, 0);
    }
  }, [currentIndex, nextTopic, onSelectQuestion, totalQuestions]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      shouldScrollToQuestionRef.current = true;
      setLocalIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < totalQuestions) {
      shouldScrollToQuestionRef.current = true;
      setLocalIndex(index);
      setIsQuestionListOpen(false);
    }
  }, [totalQuestions]);

  // Handle related question click - navigate to that question
  const handleRelatedQuestionClick = useCallback((result: RelatedQuestionResult) => {
    const targetQuestion = result.question;
    
    // If it's in the same topic, just jump to that index
    if (targetQuestion.topicId === topic.id) {
      goToQuestion(targetQuestion.sortOrder);
    } else if (onSelectQuestion) {
      onSelectQuestion(targetQuestion.topicId, targetQuestion.sortOrder);
    } else {
      setIsQuestionListOpen(false);
    }
  }, [topic.id, goToQuestion, onSelectQuestion]);

  // Comfort action handlers
  const handleComfortChange = useCallback((status: ComfortStatus) => {
    if (currentQuestion) {
      setComfortStatus(currentQuestion.id, status);
      if (!isAuthenticated) {
        setShowSignupPrompt(true);
      }
    }
  }, [currentQuestion, isAuthenticated, setComfortStatus]);

  const handleSaveToggle = useCallback(() => {
    if (currentQuestion) {
      toggleSaveForLater(currentQuestion.id);
      if (!isAuthenticated) {
        setShowSignupPrompt(true);
      }
    }
  }, [currentQuestion, isAuthenticated, toggleSaveForLater]);

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="border-slate-200">
          <CardContent className="p-8 text-center">
            <p className="text-slate-600">No questions available for this topic.</p>
            <Button onClick={onBack} variant="outline" className="mt-4">
              Return to topics
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentComfortStatus = getComfortStatus(currentQuestion.id);
  const currentSavedStatus = isSavedForLater(currentQuestion.id);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/60 via-white to-amber-50/30">
      {/* Header */}
      <PracticeHeader
        topic={topic}
        currentQuestionIndex={currentIndex}
        totalQuestions={totalQuestions}
        onBack={onBack}
      />

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 pb-20 sm:px-6">
        <div className="space-y-6">
          {/* Question Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              aria-expanded={isQuestionListOpen}
              onClick={() => setIsQuestionListOpen(prev => !prev)}
              className="border-blue-200 bg-white font-bold text-blue-800 shadow-sm shadow-blue-100 hover:border-blue-400 hover:bg-blue-50"
            >
              <List className="w-4 h-4 mr-2" />
              All questions
            </Button>

            {/* Quick Stats */}
            <div className="rounded-full bg-white px-3 py-1 text-sm font-extrabold text-slate-800 shadow-sm ring-1 ring-blue-100">
              <span className="text-blue-700">{currentIndex + 1}</span>
              <span className="text-slate-500 mx-1.5">/</span>
              <span className="text-slate-600">{totalQuestions}</span>
            </div>
          </div>

          {isQuestionListOpen && (
            <Card className="border-2 border-blue-100 bg-gradient-to-br from-white to-blue-50/60 shadow-xl shadow-slate-200/80">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-950">Questions in this topic</h3>
                    <p className="text-xs font-medium text-slate-600 mt-1">
                      Jump to any question without leaving this page.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsQuestionListOpen(false)}
                    aria-label="Close question list"
                    className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-[min(60vh,28rem)] overflow-y-auto pr-1">
                  {topic.questions.map((q, idx) => {
                    const comfort = getComfortStatus(q.id);
                    const isCurrent = idx === currentIndex;
                    
                    return (
                      <button
                        key={q.id}
                        onClick={() => goToQuestion(idx)}
                        className={cn(
                          'w-full rounded-lg border-2 p-3 text-left text-sm shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                          isCurrent 
                            ? 'border-blue-500 bg-blue-50 text-blue-950' 
                            : 'border-blue-100 bg-white hover:border-blue-300 hover:bg-blue-50/50',
                          comfort === 'understood' && !isCurrent && 'border-l-4 border-l-emerald-500',
                          comfort === 'needs-practice' && !isCurrent && 'border-l-4 border-l-amber-500',
                          comfort === 'nervous' && !isCurrent && 'border-l-4 border-l-rose-500',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span className={cn(
                            'text-xs w-5 pt-0.5',
                            isCurrent ? 'text-slate-900 font-bold' : 'text-slate-600 font-semibold'
                          )}>
                            {idx + 1}
                          </span>
                          <span className={cn(
                            'leading-relaxed',
                            isCurrent ? 'text-slate-950 font-semibold' : 'text-slate-800 font-medium'
                          )}>
                            {q.prompt}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Question Card */}
          <div ref={questionSectionRef} className="scroll-mt-[18rem] sm:scroll-mt-36">
            <QuestionCard
              question={currentQuestion}
              questionNumber={currentIndex + 1}
              totalQuestions={totalQuestions}
            />
          </div>

          {/* Comfort Actions */}
          <Card className="border-2 border-blue-100 bg-gradient-to-br from-white via-blue-50/40 to-emerald-50/30 shadow-xl shadow-slate-200/80">
            <CardContent className="p-6">
              <ComfortActions
                comfortStatus={currentComfortStatus}
                isSavedForLater={currentSavedStatus}
                onComfortChange={handleComfortChange}
                onSaveToggle={handleSaveToggle}
              />
              {showSignupPrompt && !isAuthenticated && (
                <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-extrabold text-blue-950">
                        Progress saved on this device
                      </p>
                      <p className="mt-1 text-sm text-blue-900">
                        Sign up when you are ready, and the app can remember your answers across devices.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => setShowAuthModal(true)}
                        className="bg-blue-700 hover:bg-blue-800 text-white"
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Sign up
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowSignupPrompt(false)}
                        className="text-blue-900 hover:bg-blue-100"
                      >
                        Not now
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Topic Completion PDF Download */}
          {isAtLastQuestion && (
            <Card className="border-2 border-amber-200 bg-gradient-to-br from-white via-amber-50/70 to-emerald-50/60 shadow-xl shadow-amber-100/80">
              <CardContent className="p-6">
                <AdPlacement
                  placement="practice_completion.pre_download"
                  className="mb-5 rounded-lg border border-amber-200 bg-white p-3"
                />
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-950">
                        Keep the {topic.title} PDF
                      </h3>
                      <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
                        Save the full {topic.questionCount}-question guide for review with your spouse.
                      </p>
                    </div>
                  </div>
                  <SecurePDFDownload
                    pdfFileName={topic.pdfFileName}
                    pdfTitle={topic.title}
                    topicId={topic.id}
                    categoryId={topic.categoryId}
                    source="practice_completion"
                    variant="button"
                    size="lg"
                    className="w-full justify-center border-amber-400 bg-amber-500 font-extrabold text-white shadow-md shadow-amber-100 hover:border-amber-500 hover:bg-amber-600 sm:w-auto"
                    label="Download topic PDF"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Related Questions */}
          {hasRelated && (
            <Card className="border-2 border-amber-100 bg-gradient-to-br from-white via-amber-50/40 to-blue-50/30 shadow-xl shadow-slate-200/80">
              <CardContent className="p-6">
                <RelatedQuestions
                  relatedQuestions={relatedQuestions}
                  onQuestionClick={handleRelatedQuestionClick}
                />
              </CardContent>
            </Card>
          )}

          {/* Checklist Preview */}
          {topic.checklist.length > 0 && (
            <Card className="border-2 border-emerald-100 bg-gradient-to-br from-white via-emerald-50/40 to-blue-50/30 shadow-xl shadow-slate-200/80">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-4 h-4 text-slate-600" />
                  <h4 className="font-semibold text-slate-900">Preparation checklist</h4>
                </div>
                <div className="space-y-2">
                  {topic.checklist.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-white/85 p-3 shadow-sm">
                      <Checkbox id={`checklist-${idx}`} className="mt-0.5 border-slate-300" />
                      <Label 
                        htmlFor={`checklist-${idx}`}
                        className="text-sm text-slate-800 cursor-pointer leading-relaxed"
                      >
                        {item}
                      </Label>
                    </div>
                  ))}
                  {topic.checklist.length > 3 && (
                    <p className="text-xs font-medium text-slate-600 text-center pt-2">
                      {topic.checklist.length - 3} more items available
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between border-t border-blue-100 pt-6">
            <Button
              variant="outline"
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className="min-w-[100px] border-blue-200 bg-white font-bold text-blue-800 hover:border-blue-400 hover:bg-blue-50"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>

            <Button
              onClick={goToNext}
              disabled={isAtLastQuestion && !canMoveToNextTopic}
              className="min-w-[100px] bg-gradient-to-r from-blue-600 to-cyan-600 font-bold text-white shadow-md shadow-blue-200 hover:from-blue-700 hover:to-cyan-700"
            >
              {isAtLastQuestion && canMoveToNextTopic ? 'Next Topic' : 'Next'}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </main>
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultTab="signup"
      />
    </div>
  );
}
