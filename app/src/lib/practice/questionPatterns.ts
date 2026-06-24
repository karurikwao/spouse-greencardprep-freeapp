/**
 * Question Pattern Matching System
 * 
 * This system analyzes questions to find logical connections WITHOUT generating new questions.
 * It uses:
 * 1. Keyword archetype tagging
 * 2. Logical question chains
 * 3. Semantic similarity within existing content
 */

import type { PracticeQuestion, PracticeTopic } from './types';

// Question archetypes - these are categories of questions officers commonly ask
// We use these to tag existing questions and find related ones
export type QuestionArchetype = 
  | 'location-detail'      // Where is X located?
  | 'routine-habit'        // Who does X? When do you X?
  | 'physical-description' // What does X look like? What color/size?
  | 'temporal-memory'      // When did X happen? Last time you X?
  | 'financial-detail'     // How much? Who pays? Account details?
  | 'relationship-proof'   // How did you meet? When did you know?
  | 'daily-schedule'       // What time? Wake up, go to bed?
  | 'household-detail'     // Furniture, appliances, home features
  | 'personal-preference'  // Favorite, prefer, like to
  | 'social-circle'        // Friends, family, neighbors
  | 'travel-memory'        // Trips, vacations, travel details
  | 'document-evidence'    // Papers, photos, proof
  | 'communication-pattern' // How do you contact? Apps used?
  | 'conflict-resolution'  // How do you handle disagreements?
  | 'future-plans';        // Plans, goals, children

interface ArchetypePattern {
  archetype: QuestionArchetype;
  keywords: string[];
  relatedArchetypes: QuestionArchetype[];
  description: string;
}

// Patterns for detecting question archetypes
const ARCHETYPE_PATTERNS: ArchetypePattern[] = [
  {
    archetype: 'location-detail',
    keywords: ['where', 'located', 'position', 'side', 'keep', 'store', 'put'],
    relatedArchetypes: ['routine-habit', 'household-detail'],
    description: 'Physical location of items in the home',
  },
  {
    archetype: 'routine-habit',
    keywords: ['who', 'usually', 'often', 'take out', 'clean', 'cook', 'does'],
    relatedArchetypes: ['daily-schedule', 'location-detail'],
    description: 'Regular household routines and responsibilities',
  },
  {
    archetype: 'physical-description',
    keywords: ['what color', 'what size', 'brand', 'look like', 'type of'],
    relatedArchetypes: ['location-detail', 'household-detail'],
    description: 'Physical characteristics of items',
  },
  {
    archetype: 'temporal-memory',
    keywords: ['when', 'last time', 'yesterday', 'recently', 'last night'],
    relatedArchetypes: ['daily-schedule', 'routine-habit'],
    description: 'Time-based memory questions',
  },
  {
    archetype: 'financial-detail',
    keywords: ['how much', 'cost', 'pay', 'bill', 'account', 'rent', 'price'],
    relatedArchetypes: ['document-evidence', 'routine-habit'],
    description: 'Money, bills, and financial arrangements',
  },
  {
    archetype: 'relationship-proof',
    keywords: ['how did you meet', 'when did you', 'first date', 'proposal', 'married'],
    relatedArchetypes: ['travel-memory', 'social-circle'],
    description: 'Relationship timeline and authenticity',
  },
  {
    archetype: 'daily-schedule',
    keywords: ['what time', 'wake up', 'go to bed', 'schedule', 'hours', 'alarm'],
    relatedArchetypes: ['routine-habit', 'temporal-memory'],
    description: 'Daily timing and schedules',
  },
  {
    archetype: 'household-detail',
    keywords: ['furniture', 'couch', 'bed', 'table', 'room', 'apartment', 'house'],
    relatedArchetypes: ['physical-description', 'location-detail'],
    description: 'Home furnishings and layout',
  },
  {
    archetype: 'personal-preference',
    keywords: ['favorite', 'prefer', 'like to', 'enjoy', 'usually watch'],
    relatedArchetypes: ['routine-habit', 'daily-schedule'],
    description: 'Personal likes and preferences',
  },
  {
    archetype: 'social-circle',
    keywords: ['friends', 'family', 'parents', 'neighbors', 'met', 'know'],
    relatedArchetypes: ['relationship-proof', 'travel-memory'],
    description: 'Social connections and family',
  },
  {
    archetype: 'travel-memory',
    keywords: ['trip', 'vacation', 'travel', 'went to', 'visited', 'honeymoon'],
    relatedArchetypes: ['relationship-proof', 'social-circle'],
    description: 'Shared travel experiences',
  },
  {
    archetype: 'document-evidence',
    keywords: ['photos', 'documents', 'evidence', 'pictures', 'proof', 'certificate'],
    relatedArchetypes: ['financial-detail', 'travel-memory'],
    description: 'Physical evidence of relationship',
  },
  {
    archetype: 'communication-pattern',
    keywords: ['text', 'call', 'communicate', 'message', 'phone', 'app'],
    relatedArchetypes: ['daily-schedule', 'routine-habit'],
    description: 'How couple communicates',
  },
  {
    archetype: 'conflict-resolution',
    keywords: ['argue', 'disagree', 'fight', 'decide', 'compromise', 'handle'],
    relatedArchetypes: ['routine-habit', 'relationship-proof'],
    description: 'How conflicts are resolved',
  },
  {
    archetype: 'future-plans',
    keywords: ['plan', 'future', 'children', 'kids', 'want to', 'goal'],
    relatedArchetypes: ['relationship-proof', 'social-circle'],
    description: 'Future intentions and plans',
  },
];

// Logical question chains - these define natural progressions
// Each chain is a sequence of archetypes that commonly follow each other
const LOGICAL_CHAINS: QuestionArchetype[][] = [
  ['location-detail', 'routine-habit', 'temporal-memory'],  // Where is it → Who handles it → When last
  ['physical-description', 'location-detail', 'routine-habit'], // What does it look like → Where is it → Who uses it
  ['daily-schedule', 'routine-habit', 'communication-pattern'], // Schedule → Routine → How communicate
  ['relationship-proof', 'travel-memory', 'document-evidence'], // How met → Trips → Evidence
  ['financial-detail', 'document-evidence', 'routine-habit'], // Money → Proof → Who manages
  ['household-detail', 'physical-description', 'location-detail'], // Room → Details → Location
];

/**
 * Analyze a question and return matching archetypes
 */
export function analyzeQuestionArchetypes(question: PracticeQuestion): QuestionArchetype[] {
  const prompt = question.prompt.toLowerCase();
  const matches: QuestionArchetype[] = [];

  for (const pattern of ARCHETYPE_PATTERNS) {
    const hasMatch = pattern.keywords.some(keyword => prompt.includes(keyword.toLowerCase()));
    if (hasMatch) {
      matches.push(pattern.archetype);
    }
  }

  return matches;
}

/**
 * Get related archetypes for a given archetype
 */
export function getRelatedArchetypes(archetype: QuestionArchetype): QuestionArchetype[] {
  const pattern = ARCHETYPE_PATTERNS.find(p => p.archetype === archetype);
  return pattern?.relatedArchetypes || [];
}

/**
 * Find the next logical archetype in a chain
 */
export function getNextInChain(currentArchetypes: QuestionArchetype[]): QuestionArchetype | null {
  for (const chain of LOGICAL_CHAINS) {
    // Find if current archetypes match the start of any chain
    const matchIndex = chain.findIndex((arch, idx) => {
      return currentArchetypes.includes(arch) && idx < chain.length - 1;
    });
    
    if (matchIndex !== -1) {
      return chain[matchIndex + 1];
    }
  }
  return null;
}

/**
 * Find questions matching specific archetypes within topics
 */
export function findQuestionsByArchetype(
  archetypes: QuestionArchetype[],
  topics: PracticeTopic[],
  excludeQuestionIds: string[] = [],
  maxResults: number = 4
): { question: PracticeQuestion; topic: PracticeTopic; matchReason: string }[] {
  const results: { question: PracticeQuestion; topic: PracticeTopic; matchReason: string }[] = [];

  for (const topic of topics) {
    for (const question of topic.questions) {
      if (excludeQuestionIds.includes(question.id)) continue;

      const questionArchetypes = analyzeQuestionArchetypes(question);
      const matchingArchetypes = questionArchetypes.filter(qa => archetypes.includes(qa));

      if (matchingArchetypes.length > 0) {
        results.push({
          question,
          topic,
          matchReason: `Similar topic: ${matchingArchetypes[0]}`,
        });
      }

      if (results.length >= maxResults) break;
    }
    if (results.length >= maxResults) break;
  }

  return results;
}

/**
 * Enhanced related questions that uses archetypes and chains
 */
export function getEnhancedRelatedQuestions(
  currentQuestion: PracticeQuestion,
  currentTopic: PracticeTopic,
  allTopics: PracticeTopic[],
  maxItems: number = 4
): { question: PracticeQuestion; topic: PracticeTopic; reason: string }[] {
  const results: { question: PracticeQuestion; topic: PracticeTopic; reason: string }[] = [];
  const addedIds = new Set<string>([currentQuestion.id]);

  // Step 1: Analyze current question archetypes
  const currentArchetypes = analyzeQuestionArchetypes(currentQuestion);

  // Step 2: Try to find next logical step in chains
  const nextArchetype = getNextInChain(currentArchetypes);
  if (nextArchetype) {
    const chainMatches = findQuestionsByArchetype(
      [nextArchetype],
      [currentTopic],
      Array.from(addedIds),
      maxItems
    );
    
    for (const match of chainMatches) {
      if (!addedIds.has(match.question.id)) {
        results.push({
          question: match.question,
          topic: match.topic,
          reason: 'Common follow-up',
        });
        addedIds.add(match.question.id);
      }
    }
  }

  // Step 3: Find related archetypes
  const relatedArchetypes = currentArchetypes.flatMap(getRelatedArchetypes);
  if (results.length < maxItems && relatedArchetypes.length > 0) {
    const relatedMatches = findQuestionsByArchetype(
      relatedArchetypes,
      [currentTopic],
      Array.from(addedIds),
      maxItems - results.length
    );

    for (const match of relatedMatches) {
      if (!addedIds.has(match.question.id)) {
        results.push({
          question: match.question,
          topic: match.topic,
          reason: 'Related topic',
        });
        addedIds.add(match.question.id);
      }
    }
  }

  // Step 4: Fall back to same-topic nearby questions
  if (results.length < maxItems) {
    const currentIndex = currentQuestion.sortOrder;
    const nearbyQuestions = currentTopic.questions.filter(q => {
      if (addedIds.has(q.id)) return false;
      return Math.abs(q.sortOrder - currentIndex) <= 3;
    });

    for (const q of nearbyQuestions.slice(0, maxItems - results.length)) {
      results.push({
        question: q,
        topic: currentTopic,
        reason: 'Related question',
      });
      addedIds.add(q.id);
    }
  }

  // Step 5: Cross-category using archetypes
  if (results.length < maxItems) {
    const otherTopics = allTopics.filter(t => t.id !== currentTopic.id);
    const crossTopicMatches = findQuestionsByArchetype(
      currentArchetypes,
      otherTopics,
      Array.from(addedIds),
      maxItems - results.length
    );

    for (const match of crossTopicMatches) {
      if (!addedIds.has(match.question.id)) {
        results.push({
          question: match.question,
          topic: match.topic,
          reason: `From ${match.topic.title}`,
        });
        addedIds.add(match.question.id);
      }
    }
  }

  return results;
}

/**
 * Get suggestions for what to discuss with a lawyer
 * These are question patterns that might need legal guidance
 */
export function getLawyerDiscussionSuggestions(
  question: PracticeQuestion
): { type: 'caution' | 'note' | 'prepare'; message: string }[] {
  const archetypes = analyzeQuestionArchetypes(question);
  const suggestions: { type: 'caution' | 'note' | 'prepare'; message: string }[] = [];

  for (const archetype of archetypes) {
    switch (archetype) {
      case 'relationship-proof':
        suggestions.push({
          type: 'prepare',
          message: 'Have consistent dates ready. If there are any gaps or inconsistencies in your timeline, discuss them with your attorney first.',
        });
        break;
      case 'financial-detail':
        suggestions.push({
          type: 'note',
          message: 'Know your numbers, but it\'s okay to say "I don\'t remember the exact amount."',
        });
        break;
      case 'conflict-resolution':
        suggestions.push({
          type: 'caution',
          message: 'Be honest about disagreements, but frame them constructively. If you have serious conflicts, discuss with your attorney.',
        });
        break;
      case 'document-evidence':
        suggestions.push({
          type: 'prepare',
          message: 'Organize your evidence chronologically. Bring originals and copies.',
        });
        break;
      case 'future-plans':
        suggestions.push({
          type: 'note',
          message: 'It\'s fine if plans have changed. Be honest about current intentions.',
        });
        break;
    }
  }

  // Remove duplicates
  const unique = suggestions.filter((s, idx, self) => 
    idx === self.findIndex(t => t.message === s.message)
  );

  return unique;
}
