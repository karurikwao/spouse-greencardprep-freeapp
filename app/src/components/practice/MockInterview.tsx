/**
 * Mock Interview Mode
 * Simulated interview experience
 */

import { useState, useMemo, useCallback } from 'react';
import { ArrowLeft, Mic, MessageSquare, Lightbulb, ArrowRight, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { normalizeAllTopics } from '@/lib/practice/normalize';
import { topics } from '@/data/topics';
import { getRelatedQuestions } from '@/lib/practice/relatedQuestions';
import type { PracticeQuestion, PracticeTopic } from '@/lib/practice/types';

interface MockInterviewProps {
  onBack: () => void;
}

interface InterviewQueueItem {
  topic: PracticeTopic;
  question: PracticeQuestion;
}

export function MockInterview({ onBack }: MockInterviewProps) {
  const normalizedTopics = useMemo(() => normalizeAllTopics(topics), []);

  const [interviewState, setInterviewState] = useState<'intro' | 'question' | 'followup' | 'complete'>('intro');
  const [currentQuestion, setCurrentQuestion] = useState<PracticeQuestion | null>(null);
  const [currentTopic, setCurrentTopic] = useState<PracticeTopic | null>(null);
  const [relatedQuestion, setRelatedQuestion] = useState<PracticeQuestion | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<string[]>([]);
  const [followUpMode, setFollowUpMode] = useState(false);
  const [questionQueue, setQuestionQueue] = useState<InterviewQueueItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);

  const loadQueueQuestion = useCallback((queue: InterviewQueueItem[], index: number) => {
    const item = queue[index];

    if (!item) {
      setInterviewState('complete');
      setFollowUpMode(false);
      setRelatedQuestion(null);
      return;
    }

    setCurrentTopic(item.topic);
    setCurrentQuestion(item.question);
    setShowAnswer(false);
    setRelatedQuestion(null);
    setFollowUpMode(false);
    setInterviewState('question');
  }, []);

  const buildInterviewQueue = useCallback(() => {
    const priorityTopicIds = [
      'relationship-timeline',
      'daily-routine',
      'kitchen-household',
      'family-inlaws',
      'evidence-shared-life',
      'red-flag',
      'future-plans',
      'address-history',
    ];
    const usedQuestionIds = new Set<string>();
    const queue: InterviewQueueItem[] = [];

    const addQuestion = (topic: PracticeTopic, question: PracticeQuestion) => {
      if (usedQuestionIds.has(question.id)) return;
      usedQuestionIds.add(question.id);
      queue.push({ topic, question });
    };

    priorityTopicIds.forEach((topicId, index) => {
      const topic = normalizedTopics.find(t => t.id === topicId);
      if (!topic?.questions.length) return;
      const questionIndex = Math.min(index % 3, topic.questions.length - 1);
      addQuestion(topic, topic.questions[questionIndex]);
    });

    const remainingPool = normalizedTopics.flatMap(topic =>
      topic.questions.slice(0, 4).map(question => ({ topic, question }))
    ).filter(item => !usedQuestionIds.has(item.question.id));

    while (queue.length < 8 && remainingPool.length > 0) {
      const randomIndex = Math.floor(Math.random() * remainingPool.length);
      const [item] = remainingPool.splice(randomIndex, 1);
      addQuestion(item.topic, item.question);
    }

    return queue.slice(0, 8);
  }, [normalizedTopics]);

  const startInterview = useCallback(() => {
    const queue = buildInterviewQueue();
    setQuestionQueue(queue);
    setQueueIndex(0);
    setAnsweredQuestions([]);
    loadQueueQuestion(queue, 0);
  }, [buildInterviewQueue, loadQueueQuestion]);

  const completeActiveQuestion = useCallback(() => {
    if (!currentQuestion) return;
    setAnsweredQuestions(prev => (
      prev.includes(currentQuestion.id) ? prev : [...prev, currentQuestion.id]
    ));
  }, [currentQuestion]);

  const handleNextQuestion = useCallback(() => {
    completeActiveQuestion();

    const nextIndex = queueIndex + 1;
    if (nextIndex >= questionQueue.length) {
      setInterviewState('complete');
      setFollowUpMode(false);
      setRelatedQuestion(null);
      return;
    }

    setQueueIndex(nextIndex);
    loadQueueQuestion(questionQueue, nextIndex);
  }, [completeActiveQuestion, loadQueueQuestion, questionQueue, queueIndex]);

  const showRelatedQuestion = useCallback(() => {
    if (!currentQuestion || !currentTopic) return;

    const related = getRelatedQuestions({
      currentQuestion,
      currentTopic,
      allTopics: normalizedTopics,
      maxItems: 3,
    }).filter(item => item.question.id !== currentQuestion.id);

    if (related.length > 0) {
      const randomRelated = related[Math.floor(Math.random() * related.length)];
      setRelatedQuestion(randomRelated.question);
      setFollowUpMode(true);
      setInterviewState('followup');
      setShowAnswer(false);
      return;
    }

    handleNextQuestion();
  }, [currentQuestion, currentTopic, handleNextQuestion, normalizedTopics]);

  if (interviewState === 'intro') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50/70 via-white to-amber-50/40 p-4">
        <Card className="w-full max-w-lg overflow-hidden border-2 border-blue-100 bg-gradient-to-br from-white via-blue-50/60 to-amber-50/50 shadow-2xl shadow-slate-200/80">
          <div className="h-1.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-amber-400" />
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-cyan-600 text-white shadow-lg shadow-blue-200">
              <Mic className="h-8 w-8" />
            </div>
            <h2 className="mb-2 text-2xl font-extrabold text-slate-950">Mock Interview</h2>
            <p className="mb-6 font-medium text-slate-700">
              Practice with a simulated interview experience. Questions will be presented
              one at a time, with follow-up questions based on your responses.
            </p>
            <div className="mb-6 grid gap-2 text-sm font-bold text-blue-900">
              <p className="rounded-full bg-white/85 px-3 py-2 shadow-sm ring-1 ring-blue-100">No scoring or grades</p>
              <p className="rounded-full bg-white/85 px-3 py-2 shadow-sm ring-1 ring-blue-100">Practice at your own pace</p>
              <p className="rounded-full bg-white/85 px-3 py-2 shadow-sm ring-1 ring-blue-100">Review suggested responses</p>
            </div>
            <Button onClick={startInterview} className="bg-gradient-to-r from-blue-700 to-cyan-700 font-bold text-white shadow-lg shadow-blue-200 hover:from-blue-800 hover:to-cyan-800">
              Start Mock Interview
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (interviewState === 'complete') {
    const practicedCount = Math.max(answeredQuestions.length, Math.min(queueIndex + 1, questionQueue.length));

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50/70 via-white to-blue-50/40 p-4">
        <Card className="w-full max-w-lg overflow-hidden border-2 border-emerald-100 bg-gradient-to-br from-white via-emerald-50/60 to-blue-50/50 shadow-2xl shadow-slate-200/80">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600" />
          <CardContent className="p-8 text-center">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-emerald-600" />
            <h2 className="mb-2 text-2xl font-extrabold text-slate-950">Practice Complete</h2>
            <p className="mb-6 font-medium text-slate-700">
              You practiced {practicedCount} questions.
              Great work preparing for your interview!
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={startInterview}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Practice More
              </Button>
              <Button onClick={onBack} className="bg-gradient-to-r from-emerald-600 to-cyan-600 font-bold hover:from-emerald-700 hover:to-cyan-700">
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeQuestion = followUpMode && relatedQuestion ? relatedQuestion : currentQuestion;
  const isFollowUp = followUpMode && relatedQuestion;
  const currentNumber = Math.min(queueIndex + 1, Math.max(questionQueue.length, 1));
  const totalQuestions = Math.max(questionQueue.length, 1);

  if (!activeQuestion || !currentTopic) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/70 via-white to-amber-50/40">
      <div className="sticky top-0 z-10 border-b border-blue-100 bg-white/95 shadow-sm shadow-blue-100/60 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onBack} className="font-bold text-blue-800 hover:bg-blue-50 hover:text-blue-950">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Exit
            </Button>
            <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-blue-800 ring-1 ring-blue-100">
              <Mic className="w-4 h-4" />
              <span className="text-sm font-extrabold">Mock Interview</span>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="space-y-6">
          <Card className="overflow-hidden border-2 border-blue-100 bg-gradient-to-br from-white via-blue-50/50 to-amber-50/40 shadow-xl shadow-slate-200/80">
            <div className="h-1.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-amber-400" />
            <CardContent className="p-6 sm:p-8">
              {isFollowUp && (
                <Badge className="mb-4 border-0 bg-amber-500 px-3 py-1 font-extrabold text-white shadow-sm shadow-amber-200">
                  Follow-up Question
                </Badge>
              )}

              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-200">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold leading-relaxed text-slate-950 sm:text-2xl">
                    {activeQuestion.prompt}
                  </h3>
                  <p className="mt-2 text-sm font-bold text-blue-800">{currentTopic.title}</p>
                </div>
              </div>

              {!showAnswer && (
                <Button
                  onClick={() => setShowAnswer(true)}
                  variant="outline"
                  className="mt-6 w-full border-0 bg-gradient-to-r from-blue-600 to-cyan-600 py-6 font-bold text-white shadow-lg shadow-blue-200 hover:from-blue-700 hover:to-cyan-700 hover:text-white"
                >
                  View Suggested Response
                </Button>
              )}

              {showAnswer && activeQuestion.sampleAnswer && (
                <div className="mt-6 rounded-xl border-2 border-blue-100 bg-white/90 p-5 shadow-inner">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-extrabold text-blue-900">One way to respond</span>
                  </div>
                  <p className="font-medium leading-relaxed text-slate-950">
                    {activeQuestion.sampleAnswer}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3">
            {!isFollowUp && (
              <Button
                variant="outline"
                onClick={showRelatedQuestion}
                className="flex-1 border-amber-300 bg-white font-bold text-amber-800 shadow-sm hover:border-amber-500 hover:bg-amber-50"
              >
                Practice Follow-up
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            <Button
              onClick={handleNextQuestion}
              className="flex-1 bg-gradient-to-r from-blue-700 to-cyan-700 font-bold text-white shadow-lg shadow-blue-200 hover:from-blue-800 hover:to-cyan-800"
            >
              {isFollowUp ? 'Next Question' : 'Skip to Next'}
            </Button>
          </div>

          <p className="text-center text-sm font-bold text-blue-800">
            Question {currentNumber} of {totalQuestions} - Practice at your own pace
          </p>
        </div>
      </main>
    </div>
  );
}
