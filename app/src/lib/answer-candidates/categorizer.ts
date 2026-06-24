/**
 * Answer Categorization Service
 * 
 * Assigns lightweight categories and answer patterns to candidate answers.
 * This is a rule-based keyword system (not AI/NLP) for efficiency and simplicity.
 * 
 * Purpose: Enable grouping of public example pages by common answer patterns.
 */

// Answer patterns for common interview questions
export type AnswerPattern = 
  | 'met_through_friends'
  | 'met_at_work'
  | 'met_online'
  | 'met_in_school'
  | 'met_through_family'
  | 'met_at_social_event'
  | 'met_while_traveling'
  | 'met_other'
  | 'proposal_private'
  | 'proposal_public'
  | 'proposal_tradition'
  | 'proposal_spontaneous'
  | 'wedding_courthouse'
  | 'wedding_religious'
  | 'wedding_destination'
  | 'wedding_small_gathering'
  | 'living_together'
  | 'living_separate_temp'
  | 'living_separate_permanent'
  | 'daily_routine_shared'
  | 'daily_routine_separate'
  | 'finances_joint'
  | 'finances_separate'
  | 'finances_mixed'
  | 'travel_domestic'
  | 'travel_international'
  | 'travel_both'
  | 'family_close'
  | 'family_distant'
  | 'family_mixed'
  | 'other'
  | 'uncategorized';

// Quality assessment categories
export type QualityScore =
  | 'too_short'
  | 'usable_example'
  | 'needs_cleanup'
  | 'strong_story_structure'
  | 'uncategorized';

// Pattern detection rules
interface PatternRule {
  pattern: AnswerPattern;
  keywords: string[];
  minMatchCount: number;
  questionMatchers?: RegExp[]; // Optional question matching
}

// Pattern rules for "How did you meet?" type questions
const MEETING_PATTERNS: PatternRule[] = [
  {
    pattern: 'met_through_friends',
    keywords: ['friend', 'friends', 'introduced', 'introduction', 'mutual friend', 'set us up', 'blind date', 'setup'],
    minMatchCount: 1,
    questionMatchers: [/how.*meet/i, /where.*meet/i],
  },
  {
    pattern: 'met_at_work',
    keywords: ['work', 'job', 'colleague', 'coworker', 'office', 'workplace', 'professional', 'career', 'company', 'boss', 'employee'],
    minMatchCount: 1,
    questionMatchers: [/how.*meet/i, /where.*meet/i],
  },
  {
    pattern: 'met_online',
    keywords: ['online', 'dating app', 'tinder', 'bumble', 'hinge', 'match.com', 'okcupid', 'internet', 'website', 'app', 'swipe', 'profile', 'matched'],
    minMatchCount: 1,
    questionMatchers: [/how.*meet/i, /where.*meet/i],
  },
  {
    pattern: 'met_in_school',
    keywords: ['school', 'college', 'university', 'class', 'student', 'campus', 'study', 'classmate', 'high school', 'undergrad', 'graduate'],
    minMatchCount: 1,
    questionMatchers: [/how.*meet/i, /where.*meet/i],
  },
  {
    pattern: 'met_through_family',
    keywords: ['family', 'relative', 'cousin', 'sister', 'brother', 'parents', 'mom', 'dad', 'aunt', 'uncle', 'family friend'],
    minMatchCount: 1,
    questionMatchers: [/how.*meet/i, /where.*meet/i],
  },
  {
    pattern: 'met_at_social_event',
    keywords: ['party', 'wedding', 'gathering', 'event', 'bar', 'club', 'restaurant', 'cafe', 'coffee shop', 'gym', 'church', 'temple'],
    minMatchCount: 1,
    questionMatchers: [/how.*meet/i, /where.*meet/i],
  },
  {
    pattern: 'met_while_traveling',
    keywords: ['travel', 'vacation', 'trip', 'abroad', 'tourist', 'airport', 'plane', 'flight', 'hotel', 'hostel', 'backpacking'],
    minMatchCount: 1,
    questionMatchers: [/how.*meet/i, /where.*meet/i],
  },
];

// Pattern rules for proposal questions
const PROPOSAL_PATTERNS: PatternRule[] = [
  {
    pattern: 'proposal_private',
    keywords: ['private', 'home', 'alone', 'intimate', 'quiet', 'just us', 'romantic dinner', 'bedroom', 'kitchen'],
    minMatchCount: 1,
    questionMatchers: [/propos/i, /engaged/i, /engagement/i],
  },
  {
    pattern: 'proposal_public',
    keywords: ['restaurant', 'public', 'park', 'beach', 'crowd', 'people', 'witnesses', 'spectators', 'everyone watching'],
    minMatchCount: 1,
    questionMatchers: [/propos/i, /engaged/i, /engagement/i],
  },
  {
    pattern: 'proposal_tradition',
    keywords: ['asked permission', 'parents', 'traditional', 'custom', 'culture', 'religious', 'ceremony', 'blessing'],
    minMatchCount: 1,
    questionMatchers: [/propos/i, /engaged/i, /engagement/i],
  },
  {
    pattern: 'proposal_spontaneous',
    keywords: ['spontaneous', 'sudden', 'unexpected', 'surprise', 'didn\'t plan', 'random', 'in the moment'],
    minMatchCount: 1,
    questionMatchers: [/propos/i, /engaged/i, /engagement/i],
  },
];

// Pattern rules for wedding questions
const WEDDING_PATTERNS: PatternRule[] = [
  {
    pattern: 'wedding_courthouse',
    keywords: ['courthouse', 'city hall', 'judge', 'justice of the peace', 'civil ceremony', 'legal', 'paperwork', 'simple ceremony'],
    minMatchCount: 1,
    questionMatchers: [/wedding/i, /married/i, /ceremony/i],
  },
  {
    pattern: 'wedding_religious',
    keywords: ['church', 'temple', 'mosque', 'religious', 'priest', 'minister', 'rabbi', 'imam', 'faith', 'god', 'blessing'],
    minMatchCount: 1,
    questionMatchers: [/wedding/i, /married/i, /ceremony/i],
  },
  {
    pattern: 'wedding_destination',
    keywords: ['destination', 'beach wedding', 'abroad', 'overseas', 'mexico', 'hawaii', 'caribbean', 'europe', 'resort'],
    minMatchCount: 1,
    questionMatchers: [/wedding/i, /married/i, /ceremony/i],
  },
  {
    pattern: 'wedding_small_gathering',
    keywords: ['small', 'intimate', 'close family', 'just us', 'witnesses', 'simple', 'backyard', 'home', 'few people'],
    minMatchCount: 1,
    questionMatchers: [/wedding/i, /married/i, /ceremony/i],
  },
];

// Pattern rules for living arrangement questions
const LIVING_PATTERNS: PatternRule[] = [
  {
    pattern: 'living_together',
    keywords: ['live together', 'same house', 'same apartment', 'share home', 'live with', 'reside together', 'household'],
    minMatchCount: 1,
    questionMatchers: [/live/i, /reside/i, /address/i, /home/i],
  },
  {
    pattern: 'living_separate_temp',
    keywords: ['temporarily', 'for now', 'until', 'work', 'job', 'school', 'studying', 'visa', 'immigration', 'process', 'temporary'],
    minMatchCount: 2,
    questionMatchers: [/live/i, /reside/i, /apart/i, /separate/i],
  },
  {
    pattern: 'living_separate_permanent',
    keywords: ['separate', 'different cities', 'different states', 'long distance', 'apart', 'different homes'],
    minMatchCount: 1,
    questionMatchers: [/live/i, /reside/i, /apart/i, /separate/i],
  },
];

// Pattern rules for finances
const FINANCE_PATTERNS: PatternRule[] = [
  {
    pattern: 'finances_joint',
    keywords: ['joint account', 'shared account', 'together', 'same account', 'our money', 'combined', 'joint bank'],
    minMatchCount: 1,
    questionMatchers: [/financ/i, /money/i, /bank/i, /account/i],
  },
  {
    pattern: 'finances_separate',
    keywords: ['separate accounts', 'own account', 'my money', 'their money', 'individual', 'own bank'],
    minMatchCount: 1,
    questionMatchers: [/financ/i, /money/i, /bank/i, /account/i],
  },
  {
    pattern: 'finances_mixed',
    keywords: ['both', 'some joint', 'some separate', 'shared expenses', 'split bills', 'contribute', 'portion'],
    minMatchCount: 1,
    questionMatchers: [/financ/i, /money/i, /bank/i, /account/i],
  },
];

// Combine all patterns
const ALL_PATTERNS: PatternRule[] = [
  ...MEETING_PATTERNS,
  ...PROPOSAL_PATTERNS,
  ...WEDDING_PATTERNS,
  ...LIVING_PATTERNS,
  ...FINANCE_PATTERNS,
];

/**
 * Categorize an answer based on its content and the question asked
 * 
 * @param answer The sanitized answer text
 * @param questionPrompt The question that was asked
 * @returns The detected answer pattern
 */
export function categorizeAnswer(
  answer: string,
  questionPrompt: string
): {
  pattern: AnswerPattern;
  confidence: 'high' | 'medium' | 'low';
  matchedKeywords: string[];
} {
  const answerLower = answer.toLowerCase();
  const questionLower = questionPrompt.toLowerCase();

  // Find matching patterns
  const matches: Array<{
    pattern: AnswerPattern;
    score: number;
    matchedKeywords: string[];
  }> = [];

  for (const rule of ALL_PATTERNS) {
    // Check if this pattern applies to this question type
    if (rule.questionMatchers) {
      const questionMatches = rule.questionMatchers.some(matcher => matcher.test(questionLower));
      if (!questionMatches) {
        continue;
      }
    }

    // Count keyword matches
    const matchedKeywords: string[] = [];
    for (const keyword of rule.keywords) {
      if (answerLower.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      }
    }

    if (matchedKeywords.length >= rule.minMatchCount) {
      matches.push({
        pattern: rule.pattern,
        score: matchedKeywords.length,
        matchedKeywords,
      });
    }
  }

  // Sort by score (highest first)
  matches.sort((a, b) => b.score - a.score);

  if (matches.length === 0) {
    return {
      pattern: 'uncategorized',
      confidence: 'low',
      matchedKeywords: [],
    };
  }

  const bestMatch = matches[0];
  const confidence: 'high' | 'medium' | 'low' = 
    bestMatch.score >= 3 ? 'high' :
    bestMatch.score >= 2 ? 'medium' : 'low';

  return {
    pattern: bestMatch.pattern,
    confidence,
    matchedKeywords: bestMatch.matchedKeywords,
  };
}

/**
 * Assess the quality of an answer for example purposes
 * 
 * @param answer The sanitized answer
 * @returns Quality assessment
 */
export function assessQuality(answer: string): {
  score: QualityScore;
  reason: string;
} {
  const wordCount = answer.split(/\s+/).filter(w => w.length > 0).length;
  const sentenceCount = answer.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const hasSpecificDetails = /\d{4}|\b(first|second|third|last)\b|\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(answer);
  const hasEmotionalContent = /\b(love|happy|excited|nervous|worried|glad|thankful|grateful)\b/i.test(answer);
  const hasStructure = answer.includes('.') && sentenceCount >= 2;

  // Too short
  if (wordCount < 10 || answer.length < 50) {
    return {
      score: 'too_short',
      reason: `Only ${wordCount} words - too brief to be a useful example`,
    };
  }

  // Strong structure
  if (wordCount >= 50 && sentenceCount >= 3 && hasSpecificDetails && hasEmotionalContent) {
    return {
      score: 'strong_story_structure',
      reason: `Well-structured answer with ${wordCount} words, specific details, and emotional content`,
    };
  }

  // Needs cleanup (has potential but issues)
  if (wordCount > 100 && !hasStructure) {
    return {
      score: 'needs_cleanup',
      reason: 'Long but unstructured - may need editing for clarity',
    };
  }

  if (!hasSpecificDetails && wordCount < 30) {
    return {
      score: 'needs_cleanup',
      reason: 'Lacks specific details that would make it a helpful example',
    };
  }

  // Default to usable
  return {
    score: 'usable_example',
    reason: `Good length (${wordCount} words) with acceptable structure`,
  };
}

/**
 * Get a category label for display purposes
 */
export function getPatternLabel(pattern: AnswerPattern): string {
  const labels: Record<AnswerPattern, string> = {
    met_through_friends: 'Met Through Friends',
    met_at_work: 'Met at Work',
    met_online: 'Met Online',
    met_in_school: 'Met in School',
    met_through_family: 'Met Through Family',
    met_at_social_event: 'Met at Social Event',
    met_while_traveling: 'Met While Traveling',
    met_other: 'Met (Other)',
    proposal_private: 'Private Proposal',
    proposal_public: 'Public Proposal',
    proposal_tradition: 'Traditional Proposal',
    proposal_spontaneous: 'Spontaneous Proposal',
    wedding_courthouse: 'Courthouse Wedding',
    wedding_religious: 'Religious Wedding',
    wedding_destination: 'Destination Wedding',
    wedding_small_gathering: 'Small Gathering',
    living_together: 'Living Together',
    living_separate_temp: 'Temporarily Apart',
    living_separate_permanent: 'Living Apart',
    daily_routine_shared: 'Shared Daily Routine',
    daily_routine_separate: 'Separate Daily Routines',
    finances_joint: 'Joint Finances',
    finances_separate: 'Separate Finances',
    finances_mixed: 'Mixed Finances',
    travel_domestic: 'Domestic Travel',
    travel_international: 'International Travel',
    travel_both: 'Mixed Travel',
    family_close: 'Close to Family',
    family_distant: 'Distant from Family',
    family_mixed: 'Mixed Family Relations',
    other: 'Other',
    uncategorized: 'Uncategorized',
  };

  return labels[pattern] || pattern;
}

/**
 * Get quality score label for display
 */
export function getQualityLabel(score: QualityScore): string {
  const labels: Record<QualityScore, string> = {
    too_short: 'Too Short',
    usable_example: 'Usable Example',
    needs_cleanup: 'Needs Cleanup',
    strong_story_structure: 'Strong Story',
    uncategorized: 'Uncategorized',
  };

  return labels[score];
}
