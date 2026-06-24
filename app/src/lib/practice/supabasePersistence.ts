/**
* Supabase Persistence Layer for Practice State
*
* Provides cloud sync for:
* - Question comfort status
* - Save for later
* - Current question index per topic
* - User preferences
*
* Falls back to localStorage when offline or not authenticated
*/

import { apiClient } from '@/lib/apiClient';
import type { ComfortStatus, QuestionState } from './types';

// Table names
const TABLES = {
  QUESTION_STATES: 'question_states',
  TOPIC_PROGRESS: 'user_topic_progress',
  USER_PREFERENCES: 'user_preferences',
} as const;

// Database types
interface DBQuestionState {
id?: string;
user_id: string;
question_id: string;
topic_id: string;
comfort_status: ComfortStatus;
is_saved_for_later: boolean;
last_reviewed_at: string | null;
created_at?: string;
updated_at?: string;
}

interface DBTopicProgress {
id?: string;
user_id: string;
topic_id: string;
current_question_index: number;
is_completed: boolean;
updated_at?: string;
}

// User preferences - available for future use
// interface DBUserPreferences {
// id?: string;
// user_id: string;
// preferences: Record<string, unknown>;
// updated_at?: string;
// }

// Check if API is properly configured
const isApiConfigured = () => {
return !!import.meta.env.VITE_API_URL;
};

// Check if user is authenticated
const getCurrentUser = async () => {
if (!isApiConfigured()) return null;
const { data: user, error } = await apiClient.auth.getUser();
if (error || !user) return null;
return user;
};

/**
* Save question state to Supabase
*/
export async function saveQuestionStateToSupabase(
questionId: string,
topicId: string,
state: QuestionState
): Promise<boolean> {
const user = await getCurrentUser();
if (!user) return false;

const dbState: DBQuestionState = {
user_id: user.id,
question_id: questionId,
topic_id: topicId,
comfort_status: state.comfortStatus,
is_saved_for_later: state.isSavedForLater,
last_reviewed_at: state.lastReviewedAt,
};

  // Use upsert to handle both insert and update
  const { error } = await apiClient
    .from(TABLES.QUESTION_STATES)
    .upsert(dbState as unknown as Record<string, unknown>, {
      onConflict: 'user_id,question_id',
    });

if (error) {
console.error('Error saving question state:', error.message);
return false;
}

return true;
}

/**
* Load all question states for a user from Supabase
*/
export async function loadQuestionStatesFromSupabase(): Promise<Record<string, QuestionState> | null> {
const user = await getCurrentUser();
if (!user) return null;

const { data, error } = await apiClient
.from(TABLES.QUESTION_STATES)
.select('*')
.eq('user_id', user.id);

if (error) {
console.error('Error loading question states:', error.message);
return null;
}

if (!data) return {};

// Convert to our internal format
const states: Record<string, QuestionState> = {};
for (const row of data as DBQuestionState[]) {
states[row.question_id] = {
comfortStatus: row.comfort_status,
isSavedForLater: row.is_saved_for_later,
lastReviewedAt: row.last_reviewed_at,
};
}

return states;
}

/**
* Save topic progress (current question index) to Supabase
*/
export async function saveTopicProgressToSupabase(
topicId: string,
currentIndex: number,
isCompleted: boolean = false
): Promise<boolean> {
const user = await getCurrentUser();
if (!user) return false;

const progress: DBTopicProgress = {
user_id: user.id,
topic_id: topicId,
current_question_index: currentIndex,
is_completed: isCompleted,
};

  const { error } = await apiClient
    .from(TABLES.TOPIC_PROGRESS)
    .upsert(progress as unknown as Record<string, unknown>, {
      onConflict: 'user_id,topic_id',
    });

if (error) {
console.error('Error saving topic progress:', error.message);
return false;
}

return true;
}

/**
* Load all topic progress for a user from Supabase
*/
export async function loadTopicProgressFromSupabase(): Promise<Record<string, number> | null> {
const user = await getCurrentUser();
if (!user) return null;

const { data, error } = await apiClient
.from(TABLES.TOPIC_PROGRESS)
.select('*')
.eq('user_id', user.id);

if (error) {
console.error('Error loading topic progress:', error.message);
return null;
}

if (!data) return {};

const progress: Record<string, number> = {};
for (const row of data as DBTopicProgress[]) {
progress[row.topic_id] = row.current_question_index;
}

return progress;
}

/**
* Get all saved questions for the current user
*/
export async function getSavedQuestionsFromSupabase(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await apiClient
    .from(TABLES.QUESTION_STATES)
    .select('question_id, is_saved_for_later')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error loading saved questions:', error.message);
    return [];
  }

  return (data as { question_id: string; is_saved_for_later: boolean }[])
    .filter(row => row.is_saved_for_later)
    .map(row => row.question_id);
}

/**
* Get questions by comfort status
*/
export async function getQuestionsByComfortStatus(
  status: ComfortStatus
): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user || !status) return [];

  const { data, error } = await apiClient
    .from(TABLES.QUESTION_STATES)
    .select('question_id, comfort_status')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error loading questions by status:', error.message);
    return [];
  }

  return (data as { question_id: string; comfort_status: ComfortStatus }[])
    .filter(row => row.comfort_status === status)
    .map(row => row.question_id);
}

/**
* Get practice statistics for the current user
*/
export async function getPracticeStatsFromSupabase(): Promise<{
totalQuestionsReviewed: number;
understoodCount: number;
needsPracticeCount: number;
nervousCount: number;
savedCount: number;
topicsStarted: number;
} | null> {
const user = await getCurrentUser();
if (!user) return null;

// Get all question states
const { data: statesData, error: statesError } = await apiClient
.from(TABLES.QUESTION_STATES)
.select('*')
.eq('user_id', user.id);

if (statesError) {
console.error('Error loading stats:', statesError.message);
return null;
}

// Get topic progress
const { data: topicsData, error: topicsError } = await apiClient
.from(TABLES.TOPIC_PROGRESS)
.select('*')
.eq('user_id', user.id);

if (topicsError) {
console.error('Error loading topic stats:', topicsError.message);
return null;
}

const states = statesData as DBQuestionState[];

return {
totalQuestionsReviewed: states.filter(s => s.last_reviewed_at).length,
understoodCount: states.filter(s => s.comfort_status === 'understood').length,
needsPracticeCount: states.filter(s => s.comfort_status === 'needs-practice').length,
nervousCount: states.filter(s => s.comfort_status === 'nervous').length,
savedCount: states.filter(s => s.is_saved_for_later).length,
topicsStarted: (topicsData as DBTopicProgress[]).length,
};
}

/**
* Sync local state to Supabase (useful for initial migration)
*/
export async function syncLocalStateToSupabase(
questionStates: Record<string, QuestionState>,
topicProgress: Record<string, number>
): Promise<boolean> {
const user = await getCurrentUser();
if (!user) return false;

// Batch upsert question states
const dbStates: DBQuestionState[] = Object.entries(questionStates).map(([questionId, state]) => ({
user_id: user.id,
question_id: questionId,
topic_id: questionId.split('-q')[0], // Extract topic from question ID
comfort_status: state.comfortStatus,
is_saved_for_later: state.isSavedForLater,
last_reviewed_at: state.lastReviewedAt,
}));

if (dbStates.length > 0) {
    const { error: statesError } = await apiClient
    .from(TABLES.QUESTION_STATES)
    .upsert(dbStates as unknown as Record<string, unknown>[], {
      onConflict: 'user_id,question_id',
    });

if (statesError) {
console.error('Error syncing question states:', statesError.message);
return false;
}
}

// Batch upsert topic progress
const dbProgress: DBTopicProgress[] = Object.entries(topicProgress).map(([topicId, index]) => ({
user_id: user.id,
topic_id: topicId,
current_question_index: index,
is_completed: false,
}));

if (dbProgress.length > 0) {
    const { error: progressError } = await apiClient
    .from(TABLES.TOPIC_PROGRESS)
    .upsert(dbProgress as unknown as Record<string, unknown>[], {
      onConflict: 'user_id,topic_id',
    });

if (progressError) {
console.error('Error syncing topic progress:', progressError.message);
return false;
}
}

return true;
}

/**
* Check if Supabase sync is available
*/
export async function isSupabaseSyncAvailable(): Promise<boolean> {
if (!isApiConfigured()) return false;
const user = await getCurrentUser();
return !!user;
}

// Export table names for reference
export { TABLES };
