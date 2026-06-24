/**
 * usePracticeStreak Hook
 * 
 * Manages daily practice streak tracking.
 * Stores data in localStorage with Supabase sync when available.
 * Optimistic UI updates - localStorage updates immediately, Supabase syncs async.
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  getUserProgress,
  updateStreak,
  migrateLocalStorageToSupabase,
  isMigrationCompleted,
} from '@/lib/progressService';

export interface PracticeStreak {
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string | null;
  practicedToday: boolean;
}

const STREAK_STORAGE_KEY = 'practice-streak-v1';

const DEFAULT_STREAK: PracticeStreak = {
  currentStreak: 0,
  longestStreak: 0,
  lastPracticeDate: null,
  practicedToday: false,
};

/**
 * Check if two dates are consecutive days
 * Returns false if either date is invalid
 */
function isConsecutiveDay(previousDate: string, currentDate: string): boolean {
  const prev = new Date(previousDate);
  const curr = new Date(currentDate);
  
  // Check for invalid dates
  if (isNaN(prev.getTime()) || isNaN(curr.getTime())) {
    return false;
  }
  
  prev.setHours(0, 0, 0, 0);
  curr.setHours(0, 0, 0, 0);
  
  const diffTime = curr.getTime() - prev.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays === 1;
}

/**
 * Check if two dates are the same day
 * Returns false if either date is invalid
 */
function isSameDay(date1: string, date2: string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  // Check for invalid dates
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
    return false;
  }
  
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  return d1.getTime() === d2.getTime();
}

export function usePracticeStreak() {
  const [streak, setStreak] = useLocalStorage<PracticeStreak>(STREAK_STORAGE_KEY, DEFAULT_STREAK);
  const [streakMessage, setStreakMessage] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { user, isAuthenticated } = useAuth();
  
  // Use ref to track sync in progress to prevent duplicate syncs
  const syncInProgress = useRef(false);
  const migrationAttempted = useRef(false);

  // Load from Supabase on mount if user is logged in
  useEffect(() => {
    if (!isAuthenticated || !user || isInitialized || syncInProgress.current) {
      return;
    }

    const loadFromSupabase = async () => {
      syncInProgress.current = true;
      setIsSyncing(true);

      try {
        // Migrate localStorage data on first login
        if (!migrationAttempted.current && !isMigrationCompleted()) {
          migrationAttempted.current = true;
          await migrateLocalStorageToSupabase(user.id);
        }

        // Load streak data from Supabase
        const progress = await getUserProgress(user.id);
        
        if (progress) {
          // Check if Supabase data is more recent than localStorage
          const supabaseDate = progress.last_practice_date;
          const localDate = streak.lastPracticeDate;
          
          const shouldUseSupabase = supabaseDate && (!localDate || supabaseDate >= localDate);
          
          if (shouldUseSupabase) {
            const today = new Date().toISOString().split('T')[0];
            const practicedToday = supabaseDate === today;
            
            // Check if streak needs to be reset (gap in days)
            let currentStreak = progress.current_streak ?? 0;
            if (supabaseDate && !practicedToday && !isConsecutiveDay(supabaseDate, today)) {
              currentStreak = 0;
            }
            
            setStreak({
              currentStreak,
              longestStreak: progress.longest_streak ?? 0,
              lastPracticeDate: supabaseDate,
              practicedToday,
            });
          }
        }
      } catch (error) {
        console.warn('Error syncing streak from Supabase:', error);
        // Fallback to localStorage (already handled by useLocalStorage)
      } finally {
        setIsSyncing(false);
        syncInProgress.current = false;
      }
    };

    loadFromSupabase();
  }, [isAuthenticated, user, isInitialized, streak.lastPracticeDate, setStreak]);

  // Check and update streak status on mount only
  useEffect(() => {
    if (isInitialized) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    if (streak.lastPracticeDate) {
      const practicedToday = isSameDay(streak.lastPracticeDate, today);
      const wasConsecutive = isConsecutiveDay(streak.lastPracticeDate, today);
      
      // If streak is broken (more than 1 day gap), reset it
      if (!practicedToday && !wasConsecutive) {
        setStreak(prev => ({
          ...prev,
          currentStreak: 0,
          practicedToday: false,
        }));
      } else if (streak.practicedToday !== practicedToday) {
        // Only update if practicedToday changed
        setStreak(prev => ({
          ...prev,
          practicedToday,
        }));
      }
    }
    
    setIsInitialized(true);
  }, [streak.lastPracticeDate, streak.practicedToday, isInitialized, setStreak]);

  /**
   * Sync streak to Supabase (non-blocking)
   */
  const syncToSupabase = useCallback(async (
    currentStreak: number,
    longestStreak: number,
    lastPracticeDate: string
  ) => {
    if (!user || !isAuthenticated) return;

    try {
      await updateStreak(user.id, currentStreak, longestStreak, lastPracticeDate);
    } catch (error) {
      console.warn('Error syncing streak to Supabase:', error);
      // Silently fail - localStorage is the source of truth
    }
  }, [user, isAuthenticated]);

  /**
   * Record a practice session
   * Returns a message to display if streak changed
   */
  const recordPractice = useCallback((): string | null => {
    const today = new Date().toISOString().split('T')[0];
    let message: string | null = null;
    let shouldUpdateMessage = false;
    
    // Use ref to capture streak data for Supabase sync
    const newStreakDataRef = { current: 0, longest: 0, date: today, shouldSync: false };

    setStreak(prev => {
      // Validate current streak values
      const currentStreak = Math.max(0, Number(prev.currentStreak) || 0);
      const longestStreak = Math.max(0, Number(prev.longestStreak) || 0);
      
      // Already practiced today, no streak change
      if (prev.practicedToday && prev.lastPracticeDate && isSameDay(prev.lastPracticeDate, today)) {
        return prev;
      }

      let newStreak = 1;
      
      if (prev.lastPracticeDate) {
        if (isConsecutiveDay(prev.lastPracticeDate, today)) {
          // Continuing streak
          newStreak = currentStreak + 1;
          shouldUpdateMessage = true;
          message = `Great job. Your practice streak is now ${newStreak} days.`;
        } else if (isSameDay(prev.lastPracticeDate, today)) {
          // Same day, keep current streak
          newStreak = currentStreak;
        } else {
          // Streak broken, start new
          newStreak = 1;
          shouldUpdateMessage = true;
          message = "Nice progress today. You're building a new streak!";
        }
      } else {
        // First time practicing
        shouldUpdateMessage = true;
        message = "Great start! You've begun your practice streak.";
      }

      const newLongestStreak = Math.max(longestStreak, newStreak);
      
      // Store for Supabase sync
      newStreakDataRef.current = newStreak;
      newStreakDataRef.longest = newLongestStreak;
      newStreakDataRef.date = today;
      newStreakDataRef.shouldSync = true;

      return {
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastPracticeDate: today,
        practicedToday: true,
      };
    });

    if (shouldUpdateMessage && message) {
      setStreakMessage(message);
    }
    
    // Sync to Supabase in background (optimistic update)
    if (newStreakDataRef.shouldSync) {
      syncToSupabase(newStreakDataRef.current, newStreakDataRef.longest, newStreakDataRef.date);
    }
    
    return message;
  }, [setStreak, syncToSupabase]);

  /**
   * Clear the streak message
   */
  const clearStreakMessage = useCallback(() => {
    setStreakMessage(null);
  }, []);

  /**
   * Force sync with Supabase (useful for offline recovery)
   */
  const forceSync = useCallback(async () => {
    if (!user || !isAuthenticated) return;

    setIsSyncing(true);
    try {
      await syncToSupabase(streak.currentStreak, streak.longestStreak, streak.lastPracticeDate || new Date().toISOString().split('T')[0]);
    } finally {
      setIsSyncing(false);
    }
  }, [user, isAuthenticated, streak, syncToSupabase]);

  return {
    streak,
    recordPractice,
    streakMessage,
    clearStreakMessage,
    isSyncing,
    forceSync,
  };
}

export default usePracticeStreak;
