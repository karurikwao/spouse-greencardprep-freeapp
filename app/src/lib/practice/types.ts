/**
 * Practice module types - normalized internal representation
 * This abstracts away the raw data format and provides a stable interface
 */

export type ComfortStatus = 'understood' | 'needs-practice' | 'nervous' | null;

export interface PracticeQuestion {
  id: string;
  topicId: string;
  categoryId: string;
  prompt: string;
  sampleAnswer?: string;
  shortAnswer?: string;
  conversationalAnswer?: string;
  tip?: string;
  officerLookingFor?: string;
  avoidThis?: string;
  followups?: string[];
  relatedQuestionIds?: string[];
  sortOrder: number;
}

export interface PracticeTopic {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  pdfFileName: string;
  questionCount: number;
  icon: string;
  questions: PracticeQuestion[];
  checklist: string[];
}

export interface QuestionState {
  comfortStatus: ComfortStatus;
  isSavedForLater: boolean;
  lastReviewedAt: string | null;
}

export interface UserPracticeState {
  questionStates: Record<string, QuestionState>; // keyed by question.id
  currentQuestionIndex: Record<string, number>; // keyed by topic.id
}

export interface RelatedQuestionsOptions {
  currentQuestion: PracticeQuestion;
  currentTopic: PracticeTopic;
  allTopics: PracticeTopic[];
  maxItems: number;
  excludeCurrent?: boolean;
}

export interface RelatedQuestionResult {
  question: PracticeQuestion;
  topicTitle: string;
  reason: 'explicit' | 'same-topic' | 'same-category' | 'fallback';
}
