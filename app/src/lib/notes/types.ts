/**
 * Our Story Notes Types
 * Store user's real answers and notes per question
 */

export interface QuestionNote {
  questionId: string;
  ourAnswer: string;
  keyDates: string;
  locations: string;
  names: string;
  evidenceNotes: string;
  updatedAt: string;
}

export interface TopicNotes {
  topicId: string;
  generalNotes: string;
  questionNotes: Record<string, QuestionNote>; // questionId -> note
}

export const DEFAULT_NOTE: Omit<QuestionNote, 'questionId' | 'updatedAt'> = {
  ourAnswer: '',
  keyDates: '',
  locations: '',
  names: '',
  evidenceNotes: '',
};
