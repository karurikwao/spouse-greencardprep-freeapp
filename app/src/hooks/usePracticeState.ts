/**
 * Practice State Hooks - Phase 2 (Supabase + LocalStorage)
 * 
 * Manages comfort status, save for later, and question progress
 * Uses Supabase when user is authenticated, localStorage as fallback
 * Automatically syncs between the two when possible
 */

import { useCallback, useEffect, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import {
  saveQuestionStateToSupabase,
  loadQuestionStatesFromSupabase,
  saveTopicProgressToSupabase,
  loadTopicProgressFromSupabase,
  getSavedQuestionsFromSupabase,
  getQuestionsByComfortStatus,
  getPracticeStatsFromSupabase,
  syncLocalStateToSupabase,
  isSupabaseSyncAvailable,
} from '@/lib/practice/supabasePersistence';
import type { ComfortStatus, QuestionState, UserPracticeState } from '@/lib/practice/types';

const STORAGE_KEY = 'interview-practice-state-v1';

const DEFAULT_QUESTION_STATE: QuestionState = {
  comfortStatus: null,
  isSavedForLater: false,
  lastReviewedAt: null,
};

const DEFAULT_STATE: UserPracticeState = {
  questionStates: {},
  currentQuestionIndex: {},
};

export function usePracticeState() {
  const [localState, setLocalState] = useLocalStorage<UserPracticeState>(STORAGE_KEY, DEFAULT_STATE);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSupabaseAvailable, setIsSupabaseAvailable] = useState(false);

  // Check Supabase availability on mount
  useEffect(() => {
    const checkAvailability = async () => {
      const available = await isSupabaseSyncAvailable();
      setIsSupabaseAvailable(available);
    };
    checkAvailability();
  }, []);

  // Load from Supabase when available
  useEffect(() => {
    const loadFromSupabase = async () => {
      if (!isSupabaseAvailable) return;

      setIsSyncing(true);
      setSyncError(null);

      try {
        // Load question states
        const questionStates = await loadQuestionStatesFromSupabase();
        
        // Load topic progress
        const topicProgress = await loadTopicProgressFromSupabase();

        if (questionStates !== null || topicProgress !== null) {
          setLocalState(prev => ({
            questionStates: questionStates || prev.questionStates,
            currentQuestionIndex: topicProgress || prev.currentQuestionIndex,
          }));
        }
      } catch (err) {
        setSyncError('Failed to sync with cloud');
        console.error('Sync error:', err);
      } finally {
        setIsSyncing(false);
      }
    };

    loadFromSupabase();
  }, [isSupabaseAvailable, setLocalState]);

  // Get state for a specific question
  const getQuestionState = useCallback((questionId: string): QuestionState => {
    return localState.questionStates[questionId] || { ...DEFAULT_QUESTION_STATE };
  }, [localState.questionStates]);

  // Set comfort status for a question
  const setComfortStatus = useCallback(async (questionId: string, status: ComfortStatus) => {
    const topicId = questionId.split('-q')[0];
    
    // Update local state
    setLocalState(prev => {
      const newState = {
        ...prev,
        questionStates: {
          ...prev.questionStates,
          [questionId]: {
            ...(prev.questionStates[questionId] || DEFAULT_QUESTION_STATE),
            comfortStatus: status,
            lastReviewedAt: new Date().toISOString(),
          }
        }
      };
      return newState;
    });

    // Sync to Supabase if available
    if (isSupabaseAvailable) {
      const currentState = localState.questionStates[questionId] || DEFAULT_QUESTION_STATE;
      await saveQuestionStateToSupabase(questionId, topicId, {
        ...currentState,
        comfortStatus: status,
        lastReviewedAt: new Date().toISOString(),
      });
    }
  }, [localState.questionStates, setLocalState, isSupabaseAvailable]);

  // Toggle save for later status
  const toggleSaveForLater = useCallback(async (questionId: string) => {
    const topicId = questionId.split('-q')[0];
    
    setLocalState(prev => {
      const current = prev.questionStates[questionId] || DEFAULT_QUESTION_STATE;
      const newState = {
        ...prev,
        questionStates: {
          ...prev.questionStates,
          [questionId]: {
            ...current,
            isSavedForLater: !current.isSavedForLater,
          }
        }
      };
      return newState;
    });

    // Sync to Supabase if available
    if (isSupabaseAvailable) {
      const currentState = localState.questionStates[questionId] || DEFAULT_QUESTION_STATE;
      await saveQuestionStateToSupabase(questionId, topicId, {
        ...currentState,
        isSavedForLater: !currentState.isSavedForLater,
      });
    }
  }, [localState.questionStates, setLocalState, isSupabaseAvailable]);

  // Check if question is saved for later
  const isSavedForLater = useCallback((questionId: string): boolean => {
    return localState.questionStates[questionId]?.isSavedForLater || false;
  }, [localState.questionStates]);

  // Get comfort status
  const getComfortStatus = useCallback((questionId: string): ComfortStatus => {
    return localState.questionStates[questionId]?.comfortStatus || null;
  }, [localState.questionStates]);

  // Get current question index for a topic
  const getCurrentIndex = useCallback((topicId: string): number => {
    return localState.currentQuestionIndex[topicId] || 0;
  }, [localState.currentQuestionIndex]);

  // Set current question index for a topic
  const setCurrentIndex = useCallback(async (topicId: string, index: number) => {
    setLocalState(prev => ({
      ...prev,
      currentQuestionIndex: {
        ...prev.currentQuestionIndex,
        [topicId]: index,
      }
    }));

    // Sync to Supabase if available
    if (isSupabaseAvailable) {
      await saveTopicProgressToSupabase(topicId, index);
    }
  }, [setLocalState, isSupabaseAvailable]);

  // Get all saved for later questions
  const getSavedForLater = useCallback(async (): Promise<string[]> => {
    if (isSupabaseAvailable) {
      return await getSavedQuestionsFromSupabase();
    }
    return Object.entries(localState.questionStates)
      .filter(([, qs]) => qs.isSavedForLater)
      .map(([questionId]) => questionId);
  }, [localState.questionStates, isSupabaseAvailable]);

  // Get questions needing practice
  const getNeedsPractice = useCallback(async (): Promise<string[]> => {
    if (isSupabaseAvailable) {
      return await getQuestionsByComfortStatus('needs-practice');
    }
    return Object.entries(localState.questionStates)
      .filter(([, qs]) => qs.comfortStatus === 'needs-practice')
      .map(([questionId]) => questionId);
  }, [localState.questionStates, isSupabaseAvailable]);

  // Get questions marked as nervous
  const getNervousQuestions = useCallback(async (): Promise<string[]> => {
    if (isSupabaseAvailable) {
      return await getQuestionsByComfortStatus('nervous');
    }
    return Object.entries(localState.questionStates)
      .filter(([, qs]) => qs.comfortStatus === 'nervous')
      .map(([questionId]) => questionId);
  }, [localState.questionStates, isSupabaseAvailable]);

  // Get practice stats
  const getStats = useCallback(async () => {
    if (isSupabaseAvailable) {
      return await getPracticeStatsFromSupabase();
    }
    
    // Local fallback
    const states = Object.values(localState.questionStates);
    const topics = Object.keys(localState.currentQuestionIndex);
    
    return {
      totalQuestionsReviewed: states.filter(s => s.lastReviewedAt).length,
      understoodCount: states.filter(s => s.comfortStatus === 'understood').length,
      needsPracticeCount: states.filter(s => s.comfortStatus === 'needs-practice').length,
      nervousCount: states.filter(s => s.comfortStatus === 'nervous').length,
      savedCount: states.filter(s => s.isSavedForLater).length,
      topicsStarted: topics.length,
    };
  }, [localState, isSupabaseAvailable]);

  // Reset all practice state
  const resetPracticeState = useCallback(() => {
    setLocalState(DEFAULT_STATE);
  }, [setLocalState]);

  // Manual sync to Supabase
  const syncToCloud = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseAvailable) return false;
    
    setIsSyncing(true);
    try {
      const success = await syncLocalStateToSupabase(
        localState.questionStates,
        localState.currentQuestionIndex
      );
      return success;
    } catch (err) {
      setSyncError('Sync failed');
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [localState, isSupabaseAvailable]);

  return {
    // Question state getters
    getQuestionState,
    getComfortStatus,
    isSavedForLater,
    
    // Question state setters
    setComfortStatus,
    toggleSaveForLater,
    
    // Progress tracking
    getCurrentIndex,
    setCurrentIndex,
    
    // Aggregated lists (async)
    getSavedForLater,
    getNeedsPractice,
    getNervousQuestions,
    
    // Stats
    getStats,
    
    // Reset
    resetPracticeState,
    
    // Sync
    syncToCloud,
    isSyncing,
    syncError,
    isSupabaseAvailable,
  };
}

export type PracticeStateReturn = ReturnType<typeof usePracticeState>;
