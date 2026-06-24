/**
 * Interview Readiness Check Types
 */

export type ReadinessCategory = 
  | 'relationship-story'
  | 'timeline-clarity'
  | 'daily-life'
  | 'family-knowledge'
  | 'sensitive-questions'
  | 'document-prep';

export interface ReadinessQuestion {
  id: string;
  category: ReadinessCategory;
  question: string;
  options: {
    text: string;
    score: number; // 0-100
  }[];
}

export interface ReadinessResult {
  overallScore: number;
  categoryScores: Record<ReadinessCategory, number>;
  answers: Record<string, string>; // questionId -> option text
  completedAt: string;
  recommendations: string[];
}

export const READINESS_CATEGORIES: Record<ReadinessCategory, { label: string; description: string }> = {
  'relationship-story': {
    label: 'Relationship Story',
    description: 'How you met, your journey together',
  },
  'timeline-clarity': {
    label: 'Timeline Clarity',
    description: 'Important dates and milestones',
  },
  'daily-life': {
    label: 'Daily Life Details',
    description: 'Your routines and shared life',
  },
  'family-knowledge': {
    label: 'Family Knowledge',
    description: 'Knowing each other\'s families',
  },
  'sensitive-questions': {
    label: 'Sensitive Topics',
    description: 'Handling difficult questions',
  },
  'document-prep': {
    label: 'Document Preparation',
    description: 'Evidence and paperwork readiness',
  },
};

// Sample readiness questions
export const READINESS_QUESTIONS: ReadinessQuestion[] = [
  {
    id: 'rel-1',
    category: 'relationship-story',
    question: 'Can you clearly describe how you and your spouse first met?',
    options: [
      { text: 'Yes, I can describe the date, location, and circumstances in detail', score: 100 },
      { text: 'I know the general details but might forget some specifics', score: 70 },
      { text: 'I remember but some details are fuzzy', score: 40 },
      { text: 'I\'m not sure about the exact details', score: 20 },
    ],
  },
  {
    id: 'rel-2',
    category: 'relationship-story',
    question: 'Do you and your spouse agree on your relationship timeline?',
    options: [
      { text: 'Yes, we\'ve discussed and agree on all major dates', score: 100 },
      { text: 'Mostly, but we need to review a few details', score: 70 },
      { text: 'We haven\'t discussed all the details yet', score: 40 },
      { text: 'I\'m not sure if our stories match', score: 20 },
    ],
  },
  {
    id: 'time-1',
    category: 'timeline-clarity',
    question: 'Can you name the exact dates of your first date, engagement, and wedding?',
    options: [
      { text: 'Yes, I know all three dates precisely', score: 100 },
      { text: 'I know the months and years, maybe not exact days', score: 70 },
      { text: 'I know the general timeframe', score: 40 },
      { text: 'I\'m not sure about the exact dates', score: 20 },
    ],
  },
  {
    id: 'daily-1',
    category: 'daily-life',
    question: 'Do you know your spouse\'s daily routine?',
    options: [
      { text: 'Yes, I can describe their typical day in detail', score: 100 },
      { text: 'I know most of their routine', score: 70 },
      { text: 'I know some parts but not everything', score: 40 },
      { text: 'I\'m not very familiar with their daily routine', score: 20 },
    ],
  },
  {
    id: 'daily-2',
    category: 'daily-life',
    question: 'Can you describe your living space and who uses what?',
    options: [
      { text: 'Yes, I can describe our home and habits clearly', score: 100 },
      { text: 'Mostly, but I might forget some minor details', score: 70 },
      { text: 'I know the basics', score: 40 },
      { text: 'I\'m not sure about all the details', score: 20 },
    ],
  },
  {
    id: 'fam-1',
    category: 'family-knowledge',
    question: 'Do you know your spouse\'s parents\' names and where they live?',
    options: [
      { text: 'Yes, I know names, locations, and details about them', score: 100 },
      { text: 'I know names and general locations', score: 70 },
      { text: 'I know names but not much else', score: 40 },
      { text: 'I\'m not sure about some details', score: 20 },
    ],
  },
  {
    id: 'sens-1',
    category: 'sensitive-questions',
    question: 'Have you discussed how to handle questions about past relationships?',
    options: [
      { text: 'Yes, we\'re prepared to answer honestly and consistently', score: 100 },
      { text: 'We\'ve talked about it briefly', score: 70 },
      { text: 'We should discuss this more', score: 40 },
      { text: 'We haven\'t discussed this', score: 20 },
    ],
  },
  {
    id: 'doc-1',
    category: 'document-prep',
    question: 'Do you have organized evidence of your shared life?',
    options: [
      { text: 'Yes, we have photos, bills, and documents organized', score: 100 },
      { text: 'We have most documents but need to organize them', score: 70 },
      { text: 'We have some evidence', score: 40 },
      { text: 'We haven\'t gathered evidence yet', score: 20 },
    ],
  },
];
