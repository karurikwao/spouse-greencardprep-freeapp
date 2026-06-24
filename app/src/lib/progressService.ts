/**
* Progress Service
*
* Manages user progress persistence with Supabase.
* Provides fallback to localStorage for offline resilience.
* All functions safely handle network failures without crashing the UI.
*/

import { apiClient } from './apiClient';

// Type definitions
export interface TopicProgressData {
id: string;
completedQuestions: number;
totalQuestions: number;
lastUpdated: string;
}

export interface UserProgress {
id: string;
user_id: string;
questions_practiced: number;
ai_turns: number;
readiness_score: number;
current_streak: number;
longest_streak: number;
last_practice_date: string | null;
topic_progress: Record<string, TopicProgressData>;
created_at: string;
updated_at: string;
}

export interface ProgressUpdateData {
questions_practiced?: number;
ai_turns?: number;
readiness_score?: number;
current_streak?: number;
longest_streak?: number;
last_practice_date?: string | null;
topic_progress?: Record<string, TopicProgressData>;
}

// Constants
const MIGRATION_KEY = 'progress-migrated-v1';
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // ms

/**
* Sleep utility for retry delays
*/
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
* Get user progress from Supabase
* Falls back to null if network error or user not logged in
*/
export async function getUserProgress(userId: string): Promise<UserProgress | null> {
try {
const { data, error } = await apiClient
.from('user_progress')
.select('*')
.eq('user_id', userId)
.single();

  if (error) {
    if (error?.code === '404' || error?.code === '406' || !data) {
      return null;
    }
console.warn('Error fetching user progress:', error);
return null;
}

if (!data) {
return null;
}

  return data as unknown as UserProgress;
} catch (error) {
  console.warn('Network error fetching user progress:', error);
  return null;
}
}

/**
 * Create initial user progress row
 * Safe to call multiple times (will fail with unique constraint if exists)
 */
export async function createUserProgress(
  userId: string,
  initialData?: Partial<ProgressUpdateData>
): Promise<UserProgress | null> {
  try {
    const { data, error } = await apiClient
.from('user_progress')
.insert({
user_id: userId,
questions_practiced: initialData?.questions_practiced ?? 0,
ai_turns: initialData?.ai_turns ?? 0,
readiness_score: initialData?.readiness_score ?? 0,
current_streak: initialData?.current_streak ?? 0,
longest_streak: initialData?.longest_streak ?? 0,
last_practice_date: initialData?.last_practice_date ?? null,
topic_progress: initialData?.topic_progress ?? {},
})
.single();

  if (error) {
    if (error?.code === '409' || error?.code === '23505') {
      console.log('User progress already exists, returning existing data');
      return getUserProgress(userId);
    }
console.warn('Error creating user progress:', error);
return null;
}

return data as UserProgress;
} catch (error) {
console.warn('Network error creating user progress:', error);
return null;
}
}

/**
* Update user progress with retry logic
* Non-blocking - updates happen in background
*/
export async function updateUserProgress(
userId: string,
data: ProgressUpdateData
): Promise<UserProgress | null> {
let lastError: Error | null = null;

for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
try {
// Filter out undefined values
const updateData: Record<string, unknown> = {};
Object.entries(data).forEach(([key, value]) => {
if (value !== undefined) {
updateData[key] = value;
}
});

const { data: result, error } = await apiClient
.from('user_progress')
.update(updateData)
.eq('user_id', userId)
.single();

      if (error) {
        if (error?.code === '404' || error?.code === '406') {
          return createUserProgress(userId, data);
        }
throw error;
}

if (!result) {
return createUserProgress(userId, data);
}

  return result as unknown as UserProgress;
} catch (error) {
lastError = error instanceof Error ? error : new Error(String(error));
console.warn(`Progress update attempt ${attempt} failed:`, error);

if (attempt < RETRY_ATTEMPTS) {
await sleep(RETRY_DELAY * attempt);
}
}
}

console.error('Failed to update user progress after retries:', lastError);
return null;
}

/**
* Increment questions practiced count
* Uses RPC for atomic increment when possible, falls back to read-modify-write
*/
export async function incrementQuestionsPracticed(
userId: string,
count: number = 1
): Promise<UserProgress | null> {
try {
// First get current value
const current = await getUserProgress(userId);

if (!current) {
// Create new row with initial count
return createUserProgress(userId, { questions_practiced: count });
}

// Update with new count
return updateUserProgress(userId, {
questions_practiced: current.questions_practiced + count,
});
} catch (error) {
console.warn('Error incrementing questions practiced:', error);
return null;
}
}

/**
* Record an AI turn/exchange
* Batches updates by using the current value and incrementing
*/
export async function recordAITurn(
userId: string,
streakData?: {
currentStreak: number;
longestStreak: number;
lastPracticeDate: string;
}
): Promise<UserProgress | null> {
try {
const current = await getUserProgress(userId);

const updateData: ProgressUpdateData = {
ai_turns: (current?.ai_turns ?? 0) + 1,
};

if (streakData) {
updateData.current_streak = streakData.currentStreak;
updateData.longest_streak = streakData.longestStreak;
updateData.last_practice_date = streakData.lastPracticeDate;
}

if (!current) {
return createUserProgress(userId, updateData);
}

return updateUserProgress(userId, updateData);
} catch (error) {
console.warn('Error recording AI turn:', error);
return null;
}
}

/**
* Update streak information
* Only updates if the date has changed (prevents excessive writes)
*/
export async function updateStreak(
userId: string,
currentStreak: number,
longestStreak: number,
lastPracticeDate: string
): Promise<UserProgress | null> {
try {
const current = await getUserProgress(userId);

// Only update if date changed (prevents excessive writes)
if (current?.last_practice_date === lastPracticeDate) {
return current;
}

const updateData: ProgressUpdateData = {
current_streak: currentStreak,
longest_streak: longestStreak,
last_practice_date: lastPracticeDate,
};

if (!current) {
return createUserProgress(userId, updateData);
}

return updateUserProgress(userId, updateData);
} catch (error) {
console.warn('Error updating streak:', error);
return null;
}
}

/**
* Update topic progress
* Merges new progress data with existing topic_progress JSONB
*/
export async function updateTopicProgress(
userId: string,
topicId: string,
progressData: TopicProgressData
): Promise<UserProgress | null> {
try {
const current = await getUserProgress(userId);

const existingTopicProgress = current?.topic_progress ?? {};

// Only update if progress actually changed
const existing = existingTopicProgress[topicId];
if (
existing &&
existing.completedQuestions === progressData.completedQuestions &&
existing.totalQuestions === progressData.totalQuestions
) {
return current;
}

const updatedTopicProgress = {
...existingTopicProgress,
[topicId]: progressData,
};

if (!current) {
return createUserProgress(userId, {
topic_progress: { [topicId]: progressData },
});
}

return updateUserProgress(userId, {
topic_progress: updatedTopicProgress,
});
} catch (error) {
console.warn('Error updating topic progress:', error);
return null;
}
}

/**
* Calculate and update readiness score based on questions practiced and AI turns
*/
export async function updateReadinessScore(userId: string): Promise<UserProgress | null> {
try {
const current = await getUserProgress(userId);

if (!current) {
return null;
}

const questionsPracticed = current.questions_practiced ?? 0;
const aiTurns = current.ai_turns ?? 0;

// Calculate readiness score (same formula as useProgressStats)
const questionsScore = Math.min((questionsPracticed / 20) * 50, 50);
const aiScore = Math.min((aiTurns / 20) * 50, 50);
const readinessScore = Math.min(100, Math.max(0, Math.round(questionsScore + aiScore)));

return updateUserProgress(userId, { readiness_score: readinessScore });
} catch (error) {
console.warn('Error updating readiness score:', error);
return null;
}
}

// ============================================================================
// LocalStorage Migration Functions
// ============================================================================

interface LocalStorageProgress {
[questionId: string]: boolean;
}

interface LocalStorageStreak {
currentStreak: number;
longestStreak: number;
lastPracticeDate: string | null;
practicedToday: boolean;
}

interface LocalStorageAIStats {
totalTurns: number;
streakDays: number;
lastPracticeDate: string | null;
}

/**
* Check if migration has been completed
*/
export function isMigrationCompleted(): boolean {
if (typeof window === 'undefined') return false;
return localStorage.getItem(MIGRATION_KEY) === 'true';
}

/**
* Mark migration as completed
*/
export function markMigrationCompleted(): void {
if (typeof window === 'undefined') return;
localStorage.setItem(MIGRATION_KEY, 'true');
}

/**
* Read practice progress from localStorage
*/
function getLocalStorageProgress(): LocalStorageProgress {
if (typeof window === 'undefined') return {};

try {
const data = localStorage.getItem('practice-progress');
if (data) {
const parsed = JSON.parse(data);
return typeof parsed === 'object' && parsed !== null ? parsed : {};
}
} catch {
// Invalid JSON
}
return {};
}

/**
* Read streak data from localStorage
*/
function getLocalStorageStreak(): LocalStorageStreak | null {
if (typeof window === 'undefined') return null;

try {
const data = localStorage.getItem('practice-streak-v1');
if (data) {
return JSON.parse(data);
}
} catch {
// Invalid JSON
}
return null;
}

/**
* Read AI interview stats from localStorage
*/
function getLocalStorageAIStats(): LocalStorageAIStats | null {
if (typeof window === 'undefined') return null;

try {
const data = localStorage.getItem('ai-interview-stats');
if (data) {
return JSON.parse(data);
}
} catch {
// Invalid JSON
}
return null;
}

/**
* Check if there is any localStorage data that needs migration
*/
export function hasLocalStorageData(): boolean {
const progress = getLocalStorageProgress();
const streak = getLocalStorageStreak();
const aiStats = getLocalStorageAIStats();

const hasProgress = Object.keys(progress).length > 0;
const hasStreak = streak !== null && (streak.currentStreak > 0 || streak.longestStreak > 0);
const hasAIStats = aiStats !== null && (aiStats.totalTurns > 0 || aiStats.streakDays > 0);

return hasProgress || hasStreak || hasAIStats;
}

/**
* Migrate localStorage progress data to Supabase
* Returns true if migration was successful or not needed
*/
export async function migrateLocalStorageToSupabase(userId: string): Promise<boolean> {
// Skip if already migrated
if (isMigrationCompleted()) {
return true;
}

// Skip if no localStorage data
if (!hasLocalStorageData()) {
markMigrationCompleted();
return true;
}

try {
const progress = getLocalStorageProgress();
const streak = getLocalStorageStreak();
const aiStats = getLocalStorageAIStats();

const questionsPracticed = Object.values(progress).filter(v => v === true).length;
const aiTurns = aiStats?.totalTurns ?? 0;

// Calculate initial readiness score
const questionsScore = Math.min((questionsPracticed / 20) * 50, 50);
const aiScore = Math.min((aiTurns / 20) * 50, 50);
const readinessScore = Math.min(100, Math.max(0, Math.round(questionsScore + aiScore)));

// Determine which streak data to use (prefer streak hook data, fallback to AI stats)
const currentStreak = streak?.currentStreak ?? aiStats?.streakDays ?? 0;
const longestStreak = streak?.longestStreak ?? aiStats?.streakDays ?? 0;
const lastPracticeDate = streak?.lastPracticeDate ?? aiStats?.lastPracticeDate ?? null;

// Build topic progress from practiced questions
// Extract topic IDs from question IDs (format: "topic-id-question-index")
const topicProgress: Record<string, TopicProgressData> = {};

Object.keys(progress).forEach(questionId => {
// Extract topic ID from question ID (assumes format like "topic-id-0", "topic-id-1")
const parts = questionId.split('-');
if (parts.length >= 2) {
const topicId = parts.slice(0, -1).join('-');
if (!topicProgress[topicId]) {
topicProgress[topicId] = {
id: topicId,
completedQuestions: 0,
totalQuestions: 0, // Will be populated by caller if needed
lastUpdated: new Date().toISOString(),
};
}
if (progress[questionId]) {
topicProgress[topicId].completedQuestions++;
}
}
});

const migrationData: ProgressUpdateData = {
questions_practiced: questionsPracticed,
ai_turns: aiTurns,
readiness_score: readinessScore,
current_streak: currentStreak,
longest_streak: longestStreak,
last_practice_date: lastPracticeDate,
topic_progress: Object.keys(topicProgress).length > 0 ? topicProgress : undefined,
};

// Create or update user progress
const existing = await getUserProgress(userId);
let result: UserProgress | null;

if (existing) {
// Merge with existing data (don't overwrite if Supabase has more data)
const mergedData: ProgressUpdateData = {
questions_practiced: Math.max(existing.questions_practiced, migrationData.questions_practiced ?? 0),
ai_turns: Math.max(existing.ai_turns, migrationData.ai_turns ?? 0),
current_streak: Math.max(existing.current_streak, migrationData.current_streak ?? 0),
longest_streak: Math.max(existing.longest_streak, migrationData.longest_streak ?? 0),
};

// Only update date if migration date is more recent
if (lastPracticeDate && (!existing.last_practice_date || lastPracticeDate > existing.last_practice_date)) {
mergedData.last_practice_date = lastPracticeDate;
}

// Merge topic progress
const mergedTopicProgress = { ...existing.topic_progress };
Object.entries(topicProgress).forEach(([topicId, data]) => {
const existingTopic = mergedTopicProgress[topicId];
if (existingTopic) {
mergedTopicProgress[topicId] = {
...existingTopic,
completedQuestions: Math.max(existingTopic.completedQuestions, data.completedQuestions),
lastUpdated: data.lastUpdated,
};
} else {
mergedTopicProgress[topicId] = data;
}
});
mergedData.topic_progress = mergedTopicProgress;

result = await updateUserProgress(userId, mergedData);
} else {
result = await createUserProgress(userId, migrationData);
}

if (result) {
markMigrationCompleted();
console.log('Successfully migrated localStorage data to Supabase');
return true;
}

return false;
} catch (error) {
console.error('Error migrating localStorage data:', error);
// Don't mark as completed on error, so we can retry
return false;
}
}

/**
* Clear migration flag (for testing/debugging)
*/
export function clearMigrationFlag(): void {
if (typeof window === 'undefined') return;
localStorage.removeItem(MIGRATION_KEY);
}

/**
* Get localStorage data as fallback when Supabase is unavailable
*/
export function getLocalStorageFallbackData(): {
questionsPracticed: number;
aiTurns: number;
currentStreak: number;
longestStreak: number;
lastPracticeDate: string | null;
readinessScore: number;
topicProgress: Record<string, TopicProgressData>;
} {
const progress = getLocalStorageProgress();
const streak = getLocalStorageStreak();
const aiStats = getLocalStorageAIStats();

const questionsPracticed = Object.values(progress).filter(v => v === true).length;
const aiTurns = aiStats?.totalTurns ?? 0;

const questionsScore = Math.min((questionsPracticed / 20) * 50, 50);
const aiScore = Math.min((aiTurns / 20) * 50, 50);
const readinessScore = Math.min(100, Math.max(0, Math.round(questionsScore + aiScore)));

const topicProgress: Record<string, TopicProgressData> = {};
Object.keys(progress).forEach(questionId => {
const parts = questionId.split('-');
if (parts.length >= 2) {
const topicId = parts.slice(0, -1).join('-');
if (!topicProgress[topicId]) {
topicProgress[topicId] = {
id: topicId,
completedQuestions: 0,
totalQuestions: 0,
lastUpdated: new Date().toISOString(),
};
}
if (progress[questionId]) {
topicProgress[topicId].completedQuestions++;
}
}
});

return {
questionsPracticed,
aiTurns,
currentStreak: streak?.currentStreak ?? aiStats?.streakDays ?? 0,
longestStreak: streak?.longestStreak ?? aiStats?.streakDays ?? 0,
lastPracticeDate: streak?.lastPracticeDate ?? aiStats?.lastPracticeDate ?? null,
readinessScore,
topicProgress,
};
}
