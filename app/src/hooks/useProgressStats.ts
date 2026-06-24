/**
 * useProgressStats Hook
 * 
 * Provides user progress statistics for the Robin AI coach interface.
 * Tracks questions practiced, AI interview turns, and streaks.
 * Syncs with Supabase when user is logged in, falls back to localStorage.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  getUserProgress,
  incrementQuestionsPracticed,
  recordAITurn as recordAITurnToSupabase,
  updateTopicProgress,
  updateReadinessScore,
  migrateLocalStorageToSupabase,
  isMigrationCompleted,
  type TopicProgressData,
} from '@/lib/progressService';

export interface TopicProgress {
  id: string;
  name: string;
  progress: number; // 0-100
  totalQuestions: number;
  completedQuestions: number;
}

export interface ProgressStats {
  questionsPracticed: number;
  aiInterviewTurns: number;
  topicsReviewed: number;
  streakDays: number;
  lastPracticeDate: string | null;
  readinessScore: number;
  topicsProgress: TopicProgress[];
}

// Default topics for progress calculation
const DEFAULT_TOPICS: Omit<TopicProgress, 'progress' | 'completedQuestions'>[] = [
  { id: 'relationship', name: 'Relationship History', totalQuestions: 25 },
  { id: 'daily-life', name: 'Daily Life Together', totalQuestions: 20 },
  { id: 'family', name: 'Family & Background', totalQuestions: 18 },
  { id: 'wedding', name: 'Wedding & Marriage', totalQuestions: 15 },
  { id: 'future', name: 'Future Plans', totalQuestions: 12 },
  { id: 'sensitive', name: 'Sensitive Topics', totalQuestions: 10 },
];

/**
 * Calculate readiness score based on questions practiced and AI turns
 */
function calculateReadinessScore(questionsPracticed: number, aiTurns: number): number {
  const questionsScore = Math.min((questionsPracticed / 20) * 50, 50);
  const aiScore = Math.min((aiTurns / 20) * 50, 50);
  return Math.min(100, Math.max(0, Math.round(questionsScore + aiScore)));
}

/**
 * Read practice progress from localStorage
 */
function getLocalStorageProgress(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  
  try {
    const localProgress = localStorage.getItem('practice-progress');
    if (localProgress) {
      const parsed = JSON.parse(localProgress);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    }
  } catch {
    // Invalid JSON
  }
  return {};
}

/**
 * Read AI interview stats from localStorage
 */
function getLocalStorageAIStats(): { totalTurns: number; streakDays: number; lastPracticeDate: string | null } {
  if (typeof window === 'undefined') {
    return { totalTurns: 0, streakDays: 0, lastPracticeDate: null };
  }
  
  try {
    const aiStats = localStorage.getItem('ai-interview-stats');
    if (aiStats) {
      const parsed = JSON.parse(aiStats);
      return {
        totalTurns: Math.max(0, Number(parsed.totalTurns) || 0),
        streakDays: Math.max(0, Number(parsed.streakDays) || 0),
        lastPracticeDate: typeof parsed.lastPracticeDate === 'string' ? parsed.lastPracticeDate : null,
      };
    }
  } catch {
    // Invalid JSON
  }
  return { totalTurns: 0, streakDays: 0, lastPracticeDate: null };
}

export function useProgressStats() {
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSynced, setHasSynced] = useState(false);
  
  const { user, isAuthenticated } = useAuth();
  const migrationAttempted = useRef(false);
  const refreshInProgress = useRef(false);

  /**
   * Calculate stats from localStorage only
   */
  const calculateLocalStats = useCallback((): ProgressStats => {
    // Get local practice stats from localStorage
    const progressData = getLocalStorageProgress();
    const questionsPracticed = Object.values(progressData).filter(v => v === true).length;

    // Get AI interview stats from localStorage
    const aiStats = getLocalStorageAIStats();
    let { totalTurns: aiInterviewTurns, streakDays, lastPracticeDate } = aiStats;

    // Recalculate streak based on date
    if (lastPracticeDate) {
      const lastDate = new Date(lastPracticeDate);
      const today = new Date();
      
      // Check if dates are valid
      if (!isNaN(lastDate.getTime())) {
        today.setHours(0, 0, 0, 0);
        lastDate.setHours(0, 0, 0, 0);
        
        const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
          // Future date (clock error), still count streak
          streakDays = streakDays || 1;
        } else if (diffDays === 0) {
          // Practiced today
          streakDays = streakDays || 1;
        } else if (diffDays === 1) {
          // Practiced yesterday - streak continues
          streakDays = streakDays || 1;
        } else {
          // Streak broken
          streakDays = 0;
        }
      } else {
        // Invalid date
        streakDays = 0;
      }
    }

    // Calculate topics progress from localStorage data
    const topicsProgress: TopicProgress[] = DEFAULT_TOPICS.map(topic => {
      const completedQuestions = Object.entries(progressData)
        .filter(([key, value]) => key.startsWith(topic.id) && value === true)
        .length;
      
      return {
        ...topic,
        completedQuestions,
        progress: Math.round((completedQuestions / topic.totalQuestions) * 100),
      };
    });

    // Calculate topics reviewed based on completed questions
    const topicsReviewed = topicsProgress.filter(t => t.progress > 0).length;

    // Calculate readiness score
    const readinessScore = calculateReadinessScore(questionsPracticed, aiInterviewTurns);

    return {
      questionsPracticed,
      aiInterviewTurns,
      topicsReviewed,
      streakDays,
      lastPracticeDate,
      readinessScore,
      topicsProgress,
    };
  }, []);

  /**
   * Merge Supabase data with localStorage data (use max values)
   */
  const mergeWithSupabaseData = useCallback(async (): Promise<ProgressStats> => {
    const localStats = calculateLocalStats();
    
    if (!isAuthenticated || !user) {
      return localStats;
    }

    try {
      // Migrate localStorage data on first load
      if (!migrationAttempted.current && !isMigrationCompleted()) {
        migrationAttempted.current = true;
        await migrateLocalStorageToSupabase(user.id);
      }

      const supabaseProgress = await getUserProgress(user.id);
      
      if (!supabaseProgress) {
        return localStats;
      }

      // Merge data: use max values from both sources
      const questionsPracticed = Math.max(
        localStats.questionsPracticed,
        supabaseProgress.questions_practiced ?? 0
      );
      
      const aiInterviewTurns = Math.max(
        localStats.aiInterviewTurns,
        supabaseProgress.ai_turns ?? 0
      );
      
      const streakDays = Math.max(
        localStats.streakDays,
        supabaseProgress.current_streak ?? 0
      );
      
      const lastPracticeDate = supabaseProgress.last_practice_date || localStats.lastPracticeDate;
      
      // Calculate readiness score from merged data
      const readinessScore = calculateReadinessScore(questionsPracticed, aiInterviewTurns);

      // Merge topic progress
      const supabaseTopicProgress = supabaseProgress.topic_progress || {};
      const topicsProgress: TopicProgress[] = DEFAULT_TOPICS.map(topic => {
        const localCompleted = localStats.topicsProgress.find(t => t.id === topic.id)?.completedQuestions ?? 0;
        const supabaseTopic = supabaseTopicProgress[topic.id];
        const supabaseCompleted = supabaseTopic?.completedQuestions ?? 0;
        const completedQuestions = Math.max(localCompleted, supabaseCompleted);
        
        return {
          ...topic,
          completedQuestions,
          progress: Math.round((completedQuestions / topic.totalQuestions) * 100),
        };
      });

      const topicsReviewed = topicsProgress.filter(t => t.progress > 0).length;

      return {
        questionsPracticed,
        aiInterviewTurns,
        topicsReviewed,
        streakDays,
        lastPracticeDate,
        readinessScore,
        topicsProgress,
      };
    } catch (err) {
      console.warn('Error merging with Supabase data:', err);
      return localStats;
    }
  }, [calculateLocalStats, isAuthenticated, user]);

  /**
   * Refresh stats from all sources
   */
  const refreshStats = useCallback(async () => {
    if (refreshInProgress.current) return;
    
    refreshInProgress.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const mergedStats = await mergeWithSupabaseData();
      setStats(mergedStats);
      setHasSynced(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress stats');
      // Fall back to localStorage only
      setStats(calculateLocalStats());
    } finally {
      setIsLoading(false);
      refreshInProgress.current = false;
    }
  }, [mergeWithSupabaseData, calculateLocalStats]);

  // Load stats on mount
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  // Record AI interview activity
  const recordAITurn = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    
    // Update localStorage immediately (optimistic update)
    const existing = localStorage.getItem('ai-interview-stats');
    let localStats = { totalTurns: 0, streakDays: 0, lastPracticeDate: null as string | null };
    
    if (existing) {
      try {
        localStats = JSON.parse(existing);
      } catch {
        // Invalid JSON
      }
    }

    const lastDate = localStats.lastPracticeDate;

    // Update streak in localStorage
    if (lastDate) {
      const last = new Date(lastDate);
      const current = new Date(today);
      last.setHours(0, 0, 0, 0);
      current.setHours(0, 0, 0, 0);
      
      const diffDays = Math.floor((current.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        localStats.streakDays = (localStats.streakDays || 0) + 1;
      } else if (diffDays > 1) {
        localStats.streakDays = 1;
      }
    } else {
      localStats.streakDays = 1;
    }

    localStats.totalTurns = (localStats.totalTurns || 0) + 1;
    localStats.lastPracticeDate = today;

    localStorage.setItem('ai-interview-stats', JSON.stringify(localStats));
    
    // Update local state immediately
    setStats(prev => {
      if (!prev) return null;
      const newAITurns = prev.aiInterviewTurns + 1;
      return {
        ...prev,
        aiInterviewTurns: newAITurns,
        readinessScore: calculateReadinessScore(prev.questionsPracticed, newAITurns),
        streakDays: localStats.streakDays,
        lastPracticeDate: today,
      };
    });

    // Sync to Supabase in background
    if (isAuthenticated && user) {
      setIsSyncing(true);
      try {
        await recordAITurnToSupabase(user.id, {
          currentStreak: localStats.streakDays,
          longestStreak: Math.max(localStats.streakDays, stats?.streakDays ?? 0),
          lastPracticeDate: today,
        });
        await updateReadinessScore(user.id);
      } catch (error) {
        console.warn('Error syncing AI turn to Supabase:', error);
      } finally {
        setIsSyncing(false);
      }
    }

    // Refresh to get merged data
    refreshStats();
  }, [isAuthenticated, user, stats?.streakDays, refreshStats]);

  // Record question practiced
  const recordQuestionPracticed = useCallback(async (questionId: string) => {
    // Update localStorage immediately (optimistic update)
    const existing = localStorage.getItem('practice-progress');
    let progress: Record<string, boolean> = {};
    
    if (existing) {
      try {
        progress = JSON.parse(existing);
      } catch {
        // Invalid JSON
      }
    }

    progress[questionId] = true;
    localStorage.setItem('practice-progress', JSON.stringify(progress));
    
    // Update local state immediately
    setStats(prev => {
      if (!prev) return null;
      const newQuestionsPracticed = prev.questionsPracticed + 1;
      
      // Update topic progress if question ID contains topic info
      const updatedTopicsProgress = prev.topicsProgress.map(topic => {
        if (questionId.startsWith(topic.id)) {
          const newCompleted = topic.completedQuestions + 1;
          return {
            ...topic,
            completedQuestions: newCompleted,
            progress: Math.round((newCompleted / topic.totalQuestions) * 100),
          };
        }
        return topic;
      });

      return {
        ...prev,
        questionsPracticed: newQuestionsPracticed,
        readinessScore: calculateReadinessScore(newQuestionsPracticed, prev.aiInterviewTurns),
        topicsProgress: updatedTopicsProgress,
        topicsReviewed: updatedTopicsProgress.filter(t => t.progress > 0).length,
      };
    });

    // Sync to Supabase in background
    if (isAuthenticated && user) {
      setIsSyncing(true);
      try {
        await incrementQuestionsPracticed(user.id, 1);
        
        // Update topic progress if we can extract topic ID
        const topicId = questionId.split('-').slice(0, -1).join('-');
        if (topicId) {
          const topic = stats?.topicsProgress.find(t => t.id === topicId);
          if (topic) {
            const topicData: TopicProgressData = {
              id: topicId,
              completedQuestions: (topic.completedQuestions + 1),
              totalQuestions: topic.totalQuestions,
              lastUpdated: new Date().toISOString(),
            };
            await updateTopicProgress(user.id, topicId, topicData);
          }
        }
        
        await updateReadinessScore(user.id);
      } catch (error) {
        console.warn('Error syncing question practice to Supabase:', error);
      } finally {
        setIsSyncing(false);
      }
    }

    // Refresh to get merged data
    refreshStats();
  }, [isAuthenticated, user, stats?.topicsProgress, refreshStats]);

  // Update topic progress directly
  const updateTopicProgressData = useCallback(async (topicId: string, completedQuestions: number) => {
    // Update local state immediately
    setStats(prev => {
      if (!prev) return null;
      
      const updatedTopicsProgress = prev.topicsProgress.map(topic => {
        if (topic.id === topicId) {
          return {
            ...topic,
            completedQuestions,
            progress: Math.round((completedQuestions / topic.totalQuestions) * 100),
          };
        }
        return topic;
      });

      return {
        ...prev,
        topicsProgress: updatedTopicsProgress,
        topicsReviewed: updatedTopicsProgress.filter(t => t.progress > 0).length,
      };
    });

    // Sync to Supabase in background
    if (isAuthenticated && user) {
      const topic = stats?.topicsProgress.find(t => t.id === topicId);
      if (topic) {
        const topicData: TopicProgressData = {
          id: topicId,
          completedQuestions,
          totalQuestions: topic.totalQuestions,
          lastUpdated: new Date().toISOString(),
        };
        
        try {
          await updateTopicProgress(user.id, topicId, topicData);
        } catch (error) {
          console.warn('Error syncing topic progress to Supabase:', error);
        }
      }
    }
  }, [isAuthenticated, user, stats?.topicsProgress]);

  return {
    stats,
    isLoading,
    isSyncing,
    error,
    hasSynced,
    refreshStats,
    recordAITurn,
    recordQuestionPracticed,
    updateTopicProgress: updateTopicProgressData,
  };
}

export default useProgressStats;
