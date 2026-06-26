/**
 * SEO Question Page
 * Indexable page for individual questions
 */

import { useMemo } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Bot, CheckCircle, ExternalLink, Lightbulb, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { normalizeAllTopics } from '@/lib/practice/normalize';
import { topics } from '@/data/topics';
import { getRelatedQuestions } from '@/lib/practice/relatedQuestions';
import type { PracticeQuestion, PracticeTopic } from '@/lib/practice/types';

interface SEOQuestionPageProps {
  questionSlug: string;
  onBack: () => void;
  onPractice: () => void;
  onAskRobin?: (draft?: string) => void;
}

function slugifyQuestion(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
}

const relatedAccents = [
  'border-blue-200 bg-gradient-to-br from-white via-blue-50/95 to-cyan-50/80 shadow-blue-100/80 hover:border-blue-400',
  'border-emerald-200 bg-gradient-to-br from-white via-emerald-50/95 to-teal-50/80 shadow-emerald-100/80 hover:border-emerald-400',
  'border-amber-200 bg-gradient-to-br from-white via-amber-50/95 to-orange-50/80 shadow-amber-100/80 hover:border-amber-400',
  'border-rose-200 bg-gradient-to-br from-white via-rose-50/95 to-pink-50/80 shadow-rose-100/80 hover:border-rose-400',
];

const relatedIconAccents = [
  'bg-gradient-to-br from-blue-600 to-cyan-500 text-white',
  'bg-gradient-to-br from-emerald-600 to-teal-500 text-white',
  'bg-gradient-to-br from-amber-500 to-orange-500 text-white',
  'bg-gradient-to-br from-rose-600 to-pink-500 text-white',
];

export function SEOQuestionPage({ questionSlug, onBack, onPractice, onAskRobin }: SEOQuestionPageProps) {
  const normalizedTopics = useMemo(() => normalizeAllTopics(topics), []);

  // Find the question from slug
  const { question, topic, relatedQuestions } = useMemo(() => {
    let foundQuestion: PracticeQuestion | null = null;
    let foundTopic: PracticeTopic | null = null;
    
    // Search through all topics
    for (const t of normalizedTopics) {
      for (const q of t.questions) {
        const slugFromQuestion = q.prompt
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '-')
          .slice(0, 50);
        
        if (slugFromQuestion === questionSlug || q.id.includes(questionSlug)) {
          foundQuestion = q;
          foundTopic = t;
          break;
        }
      }
      if (foundQuestion) break;
    }

    if (!foundQuestion || !foundTopic) {
      return { question: null, topic: null, relatedQuestions: [] };
    }

    const related = getRelatedQuestions({
      currentQuestion: foundQuestion,
      currentTopic: foundTopic,
      allTopics: normalizedTopics,
      maxItems: 4,
    });

    return { 
      question: foundQuestion, 
      topic: foundTopic, 
      relatedQuestions: related 
    };
  }, [questionSlug, normalizedTopics]);

  if (!question || !topic) {
    return (
      <div className="min-h-screen app-vivid-section flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-2 border-blue-200 bg-gradient-to-br from-white via-blue-50/90 to-cyan-50/80 shadow-xl shadow-blue-100/80">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-extrabold text-slate-950 mb-2">Question Not Found</h2>
            <p className="font-semibold text-slate-700 mb-4">
              This question may have been moved or removed.
            </p>
            <Button onClick={onBack} className="bg-gradient-to-r from-blue-700 to-cyan-600 font-extrabold text-white hover:from-blue-800 hover:to-cyan-700">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-vivid-section">
      {/* Header */}
      <header className="bg-white/95 border-b border-blue-100 shadow-sm shadow-blue-100/70 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="font-bold text-blue-800 hover:bg-blue-50 hover:text-blue-950">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <article className="space-y-6">
          {/* Breadcrumb */}
          <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-blue-200 bg-white/90 px-3 py-1.5 text-sm font-bold text-slate-700 shadow-sm shadow-blue-100">
            <span className="text-blue-800">Interview Questions</span>
            <span className="text-slate-400">/</span>
            <span>{topic.title}</span>
          </div>

          {/* Question */}
          <div>
            <Badge className="mb-3 border-0 bg-gradient-to-r from-blue-700 to-cyan-600 px-3 py-1 font-extrabold text-white shadow-md shadow-blue-200 hover:from-blue-700 hover:to-cyan-600">
              USCIS Interview Question
            </Badge>
            <h1 className="text-3xl sm:text-4xl text-slate-950 font-extrabold leading-tight">
              {question.prompt}
            </h1>
          </div>

          {/* Answer */}
          {question.sampleAnswer && (
            <Card className="overflow-hidden border-2 border-blue-200 bg-gradient-to-br from-white via-blue-50/95 to-cyan-50/80 shadow-xl shadow-blue-100/80">
              <div className="h-1.5 bg-gradient-to-r from-blue-700 via-cyan-500 to-emerald-500" />
              <CardContent className="p-6 sm:p-7">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-200">
                    <Lightbulb className="w-5 h-5" />
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-950">Suggested Response</h2>
                </div>
                <blockquote className="rounded-xl border-l-4 border-blue-500 bg-white/85 px-4 py-3 text-slate-950 leading-relaxed shadow-sm italic">
                  &ldquo;{question.sampleAnswer}&rdquo;
                </blockquote>
                <p className="text-sm font-semibold text-slate-700 mt-4">
                  This is one natural way to answer. Adapt it to match your own experience.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Tip */}
          {question.tip && (
            <Card className="border-2 border-amber-200 bg-gradient-to-br from-white via-amber-50/95 to-orange-50/80 shadow-xl shadow-amber-100/80">
              <CardContent className="p-6">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-amber-900 mb-2">
                  <Sparkles className="h-4 w-4" />
                  Helpful Context
                </h3>
                <p className="font-semibold text-amber-950">{question.tip}</p>
              </CardContent>
            </Card>
          )}

          {/* CTA */}
          <Card className="question-practice-cta overflow-hidden border-0 bg-gradient-to-br from-blue-800 via-violet-700 to-rose-600 text-white shadow-2xl shadow-blue-200">
            <div className="h-1.5 bg-gradient-to-r from-amber-300 via-orange-300 to-white/80" />
            <CardContent className="p-6 sm:p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/30">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-extrabold mb-1 !text-white drop-shadow-sm">Practice This Question</h3>
                  <p className="text-sm font-semibold !text-blue-50">
                    Get access to all 1,200+ practice questions and track your progress
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <Button onClick={onPractice} className="bg-white text-blue-950 font-extrabold shadow-lg shadow-blue-950/20 hover:bg-amber-50">
                    Start Practicing
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                  {onAskRobin && (
                    <Button
                      type="button"
                      onClick={() => onAskRobin(`Help me practice this USCIS marriage interview question: ${question.prompt}`)}
                      className="bg-cyan-300 text-slate-950 font-extrabold shadow-lg shadow-blue-950/20 hover:bg-cyan-200"
                    >
                      <Bot className="mr-2 h-4 w-4" />
                      Ask Robin
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Related Questions */}
          {relatedQuestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-100">
                  <CheckCircle className="h-5 w-5" />
                </span>
                <h3 className="text-xl font-extrabold text-slate-950">Related Questions</h3>
              </div>
              <div className="space-y-3">
                {relatedQuestions.map((related, idx) => {
                  const accent = relatedAccents[idx % relatedAccents.length];
                  const iconAccent = relatedIconAccents[idx % relatedIconAccents.length];

                  return (
                    <a
                      key={`${related.question.id}-${idx}`}
                      href={`/questions/${slugifyQuestion(related.question.prompt)}`}
                      className={`group block overflow-hidden rounded-xl border-2 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl ${accent}`}
                    >
                      <div className={`h-1.5 ${idx % 4 === 0 ? 'bg-gradient-to-r from-blue-600 to-cyan-500' : idx % 4 === 1 ? 'bg-gradient-to-r from-emerald-600 to-teal-500' : idx % 4 === 2 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-rose-600 to-pink-500'}`} />
                      <div className="flex items-start gap-4 p-5">
                        <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-extrabold shadow-lg ${iconAccent}`}>
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold leading-relaxed text-slate-950">{related.question.prompt}</p>
                          <p className="mt-2 text-sm font-semibold text-slate-700">{related.topicTitle}</p>
                        </div>
                        <ArrowRight className="mt-2 h-5 w-5 flex-shrink-0 text-blue-700 transition group-hover:translate-x-1" />
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </article>
      </main>
    </div>
  );
}
