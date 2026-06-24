/**
 * Interview Readiness Check
 * Quick assessment tool for users
 */

import { useState, useCallback } from 'react';
import { ArrowRight, RotateCcw, AlertCircle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useReadiness } from '@/hooks/useReadiness';
import { READINESS_CATEGORIES } from '@/lib/readiness/types';

interface ReadinessCheckProps {
  onComplete?: () => void;
  embedded?: boolean;
}

export function ReadinessCheck({ onComplete, embedded = false }: ReadinessCheckProps) {
  const { 
    result, 
    shouldRetake, 
    getRandomizedQuestions, 
    calculateScore, 
    saveResult,
    getRecommendedTopics,
  } = useReadiness();

  const [questions, setQuestions] = useState(() => getRandomizedQuestions());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [isRetaking, setIsRetaking] = useState(false);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex) / questions.length) * 100;

  const handleAnswer = useCallback((answer: string) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: answer }));
  }, [currentQuestion]);

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      const newResult = calculateScore(questions, answers);
      saveResult(newResult);
      setShowResults(true);
      setIsRetaking(false);
      onComplete?.();
    }
  }, [currentIndex, questions, answers, calculateScore, saveResult, onComplete]);

  const handleRetake = useCallback(() => {
    setQuestions(getRandomizedQuestions());
    setAnswers({});
    setCurrentIndex(0);
    setShowResults(false);
    setIsRetaking(true);
  }, [getRandomizedQuestions]);

  // Show results if already completed and not retaking
  if (result && !showResults && !shouldRetake && !isRetaking) {
    return (
      <ResultsView 
        result={result} 
        onRetake={handleRetake}
        recommendedTopics={getRecommendedTopics()}
      />
    );
  }

  // Show results after completing
  if (showResults) {
    const newResult = calculateScore(questions, answers);
    return (
      <ResultsView 
        result={newResult} 
        onRetake={handleRetake}
        recommendedTopics={getRecommendedTopics()}
      />
    );
  }

  return (
    <Card className={cn(
      'overflow-hidden border-2 border-blue-100 bg-gradient-to-br from-white via-blue-50/60 to-amber-50/50 shadow-xl shadow-blue-100/70',
      embedded ? '' : 'max-w-2xl mx-auto'
    )}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-200">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-xl font-extrabold text-slate-950">Interview Readiness Check</CardTitle>
            <CardDescription className="font-bold text-blue-800">
              Question {currentIndex + 1} of {questions.length}
            </CardDescription>
          </div>
        </div>
        <Progress value={progress} className="h-2 mt-2" />
      </CardHeader>

      <CardContent className="space-y-6">
        <div>
          <Badge variant="secondary" className="mb-3">
            {READINESS_CATEGORIES[currentQuestion.category].label}
          </Badge>
          <h3 className="text-xl font-extrabold text-slate-950 leading-relaxed">
            {currentQuestion.question}
          </h3>
        </div>

        <RadioGroup
          value={answers[currentQuestion.id] || ''}
          onValueChange={handleAnswer}
          className="space-y-3"
        >
          {currentQuestion.options.map((option, idx) => (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-3 rounded-xl border-2 bg-white/90 p-4 font-semibold shadow-sm transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
                answers[currentQuestion.id] === option.text
                  ? 'border-blue-400 bg-blue-50 shadow-blue-100'
                  : 'border-blue-100 hover:border-blue-300'
              )}
              onClick={() => handleAnswer(option.text)}
            >
              <RadioGroupItem 
                value={option.text} 
                id={`option-${idx}`}
                className="mt-0.5"
              />
              <Label 
                htmlFor={`option-${idx}`}
                className="text-slate-900 cursor-pointer flex-1"
              >
                {option.text}
              </Label>
            </div>
          ))}
        </RadioGroup>

        <div className="flex justify-end">
          <Button
            onClick={handleNext}
            disabled={!answers[currentQuestion.id]}
            className="bg-gradient-to-r from-blue-700 to-cyan-700 font-extrabold shadow-lg shadow-blue-200 hover:from-blue-800 hover:to-cyan-800"
          >
            {currentIndex < questions.length - 1 ? (
              <>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            ) : (
              'See Results'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultsView({ 
  result, 
  onRetake,
  recommendedTopics,
}: { 
  result: NonNullable<ReturnType<typeof useReadiness>['result']>;
  onRetake: () => void;
  recommendedTopics: string[];
}) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-rose-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-50 border-emerald-200';
    if (score >= 60) return 'bg-amber-50 border-amber-200';
    return 'bg-rose-50 border-rose-200';
  };

  return (
    <Card className="max-w-2xl mx-auto overflow-hidden border-2 border-blue-100 bg-gradient-to-br from-white via-blue-50/60 to-emerald-50/50 shadow-xl shadow-blue-100/70">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-extrabold text-slate-950">Your Interview Readiness</CardTitle>
        <CardDescription className="font-semibold text-slate-700">
          Completed {new Date(result.completedAt).toLocaleDateString()}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className={cn('p-6 rounded-xl border text-center', getScoreBg(result.overallScore))}>
          <div className={cn('text-5xl font-bold mb-2', getScoreColor(result.overallScore))}>
            {result.overallScore}%
          </div>
          <p className="text-slate-600">
            {result.overallScore >= 80 
              ? 'You\'re well prepared for your interview!' 
              : result.overallScore >= 60 
              ? 'You\'re on the right track. Keep practicing!'
              : 'Focus on the recommended areas below to improve.'}
          </p>
        </div>

        {/* Category Scores */}
        <div className="space-y-3 rounded-2xl border border-blue-100 bg-white/85 p-4 shadow-sm">
          <h4 className="font-extrabold text-slate-950">Breakdown by Category</h4>
          {(Object.keys(result.categoryScores) as Array<keyof typeof READINESS_CATEGORIES>).map((cat) => {
            const score = result.categoryScores[cat];
            return (
              <div key={cat} className="space-y-1">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-800">{READINESS_CATEGORIES[cat].label}</span>
                  <span className={getScoreColor(score)}>{score}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={cn('h-full rounded-full', 
                      score >= 80 ? 'bg-emerald-400' : score >= 60 ? 'bg-amber-400' : 'bg-rose-400'
                    )}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Recommendations */}
        {result.recommendations.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
            <h4 className="font-extrabold text-slate-950">Recommendations</h4>
            <ul className="space-y-2">
              {result.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm font-semibold text-slate-800">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommended Topics */}
        {recommendedTopics.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm">
            <h4 className="font-extrabold text-slate-950">Recommended Topics to Study</h4>
            <div className="flex flex-wrap gap-2">
              {recommendedTopics.map(topicId => (
                <Badge key={topicId} className="bg-white text-blue-800 border border-blue-200 font-bold" variant="secondary">
                  {topicId.replace(/-/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onRetake} className="flex-1 border-blue-200 bg-white font-extrabold text-blue-800 shadow-sm hover:bg-blue-50 hover:text-blue-950">
            <RotateCcw className="w-4 h-4 mr-2" />
            Retake Assessment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Need to import Badge
import { Badge } from '@/components/ui/badge';
