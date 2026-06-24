/**
 * Interview Readiness Hook
 */

import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { 
  READINESS_QUESTIONS, 
  READINESS_CATEGORIES,
  type ReadinessResult,
  type ReadinessCategory,
} from '@/lib/readiness/types';

const READINESS_RESULT_KEY = 'interview-readiness-result-v1';
const LAST_COMPLETED_KEY = 'interview-readiness-last-completed';

export function useReadiness() {
  const [result, setResult] = useLocalStorage<ReadinessResult | null>(
    READINESS_RESULT_KEY,
    null
  );
  const [lastCompleted, setLastCompleted] = useLocalStorage<string | null>(
    LAST_COMPLETED_KEY,
    null
  );

  // Get randomized questions (different each time but stable within a session)
  const getRandomizedQuestions = useCallback(() => {
    // Shuffle questions within each category
    const questionsByCategory: Record<ReadinessCategory, typeof READINESS_QUESTIONS> = {
      'relationship-story': [],
      'timeline-clarity': [],
      'daily-life': [],
      'family-knowledge': [],
      'sensitive-questions': [],
      'document-prep': [],
    };

    READINESS_QUESTIONS.forEach(q => {
      questionsByCategory[q.category].push(q);
    });

    // Select 1-2 questions from each category randomly
    const selected: typeof READINESS_QUESTIONS = [];
    Object.entries(questionsByCategory).forEach(([, questions]) => {
      const shuffled = [...questions].sort(() => Math.random() - 0.5);
      selected.push(...shuffled.slice(0, Math.min(2, shuffled.length)));
    });

    return selected.sort(() => Math.random() - 0.5);
  }, []);

  // Calculate readiness score from answers
  const calculateScore = useCallback((
    questions: typeof READINESS_QUESTIONS,
    answers: Record<string, string>
  ): ReadinessResult => {
    let totalScore = 0;
    const categoryScores: Record<ReadinessCategory, number> = {
      'relationship-story': 0,
      'timeline-clarity': 0,
      'daily-life': 0,
      'family-knowledge': 0,
      'sensitive-questions': 0,
      'document-prep': 0,
    };
    const categoryCounts: Record<ReadinessCategory, number> = {
      'relationship-story': 0,
      'timeline-clarity': 0,
      'daily-life': 0,
      'family-knowledge': 0,
      'sensitive-questions': 0,
      'document-prep': 0,
    };

    questions.forEach(q => {
      const answer = answers[q.id];
      if (answer) {
        const option = q.options.find(o => o.text === answer);
        if (option) {
          totalScore += option.score;
          categoryScores[q.category] += option.score;
          categoryCounts[q.category]++;
        }
      }
    });

    // Average scores per category
    Object.keys(categoryScores).forEach(cat => {
      const count = categoryCounts[cat as ReadinessCategory];
      if (count > 0) {
        categoryScores[cat as ReadinessCategory] = Math.round(
          categoryScores[cat as ReadinessCategory] / count
        );
      }
    });

    const overallScore = Math.round(totalScore / questions.length);

    // Generate recommendations
    const recommendations: string[] = [];
    Object.entries(categoryScores).forEach(([cat, score]) => {
      if (score < 50) {
        recommendations.push(
          `Focus on ${READINESS_CATEGORIES[cat as ReadinessCategory].label.toLowerCase()} - this area needs attention`
        );
      } else if (score < 75) {
        recommendations.push(
          `Review ${READINESS_CATEGORIES[cat as ReadinessCategory].label.toLowerCase()} to strengthen your preparation`
        );
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('You\'re well prepared! Keep practicing to maintain confidence.');
    }

    return {
      overallScore,
      categoryScores,
      answers,
      completedAt: new Date().toISOString(),
      recommendations,
    };
  }, []);

  // Save result
  const saveResult = useCallback((newResult: ReadinessResult) => {
    setResult(newResult);
    setLastCompleted(new Date().toISOString());
  }, [setResult, setLastCompleted]);

  // Check if should retake (if completed more than 7 days ago)
  const shouldRetake = useMemo(() => {
    if (!lastCompleted) return true;
    const last = new Date(lastCompleted);
    const now = new Date();
    const daysSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= 7;
  }, [lastCompleted]);

  // Get recommended topics based on lowest scores
  const getRecommendedTopics = useCallback((): string[] => {
    if (!result) return [];
    
    const topics: string[] = [];
    const sortedCategories = Object.entries(result.categoryScores)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3);

    sortedCategories.forEach(([cat]) => {
      switch (cat) {
        case 'relationship-story':
          topics.push('relationship-timeline', 'wedding-celebrations');
          break;
        case 'timeline-clarity':
          topics.push('relationship-timeline', 'address-history');
          break;
        case 'daily-life':
          topics.push('daily-routine', 'kitchen-household', 'bedroom');
          break;
        case 'family-knowledge':
          topics.push('family-inlaws');
          break;
        case 'sensitive-questions':
          topics.push('red-flag', 'conflict-resolution');
          break;
        case 'document-prep':
          topics.push('evidence-shared-life');
          break;
      }
    });

    return [...new Set(topics)];
  }, [result]);

  return {
    result,
    lastCompleted,
    shouldRetake,
    questions: READINESS_QUESTIONS,
    categories: READINESS_CATEGORIES,
    getRandomizedQuestions,
    calculateScore,
    saveResult,
    getRecommendedTopics,
  };
}

export type ReadinessHookReturn = ReturnType<typeof useReadiness>;
