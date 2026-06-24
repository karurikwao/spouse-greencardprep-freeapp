/**
 * AI Interview Prompts
 * 
 * Reusable prompt templates for the AI interview system.
 * Provider-independent prompt construction.
 */

import type { InterviewGroundingContext, FeedbackLabel } from './types';

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Main system prompt for the AI interviewer
 */
export function buildSystemPrompt(): string {
  return `You are a calm, supportive marriage-based green card interview practice coach.

YOUR ROLE:
- Help couples practice for their USCIS marriage interview
- Ask one question at a time, just like a real officer
- Provide gentle, constructive feedback
- Never judge, accuse, or use harsh grading language

TONE:
- Calm and professional
- Encouraging and supportive
- Clear and concise
- Patient with nervous users

IMPORTANT RULES:
- Ask ONE question at a time
- Wait for the user's answer before proceeding
- Provide brief, helpful feedback (2-3 sentences max)
- Follow up with a relevant next question
- Never guarantee legal outcomes
- Never accuse users of fraud or dishonesty
- Never use shaming language
- Keep responses concise (under 150 words when possible)

FEEDBACK GUIDELINES:
Use these feedback labels:
- "clear_and_natural": Answer sounds authentic and well-explained
- "could_use_more_detail": Suggest adding specific examples or dates
- "worth_reviewing_together": Recommend discussing with partner to align
- "a_little_vague": Encourage more specific details
- "review_gently": This topic may need more preparation

STRUCTURED OUTPUT:
Always respond with valid JSON in this format:
{
  "feedbackSummary": "Brief encouraging feedback (1-2 sentences)",
  "feedbackLabel": "one of: clear_and_natural, could_use_more_detail, worth_reviewing_together, a_little_vague, review_gently",
  "followUpQuestion": "The next interview question to ask",
  "suggestedReviewTopics": ["optional topic suggestions"],
  "explanation": "Brief context on why this question matters (optional)"
}`;
}

// ============================================================================
// INTERVIEW PROMPTS
// ============================================================================

/**
 * Build the user prompt for an interview turn
 */
export function buildInterviewPrompt(context: InterviewGroundingContext): string {
  const {
    question,
    topic,
    category,
    previousTurns = [],
    userStoryAnswer,
    mode,
    turnNumber,
    maxTurns,
  } = context;

  const parts: string[] = [];

  // Session context
  parts.push(`=== SESSION CONTEXT ===`);
  parts.push(`Mode: ${mode}`);
  parts.push(`Turn: ${turnNumber} of ${maxTurns}`);
  parts.push(`Topic: ${topic.title}`);
  parts.push(`Category: ${category.name}`);
  parts.push('');

  // Current question grounding
  parts.push(`=== CURRENT QUESTION ===`);
  parts.push(`Question: "${question.prompt}"`);
  if (question.sampleAnswer) {
    parts.push(`Sample Answer: "${question.sampleAnswer}"`);
  }
  if (question.officerLookingFor && question.officerLookingFor.length > 0) {
    parts.push(`What Officers Look For: ${question.officerLookingFor.join('; ')}`);
  }
  if (question.avoidThis && question.avoidThis.length > 0) {
    parts.push(`Common Mistakes to Avoid: ${question.avoidThis.join('; ')}`);
  }
  if (question.explanation) {
    parts.push(`Why This Matters: ${question.explanation}`);
  }
  parts.push('');

  // User's personal notes (if available)
  if (userStoryAnswer?.actualAnswer) {
    parts.push(`=== USER'S SAVED ANSWER (OUR STORY) ===`);
    parts.push(userStoryAnswer.actualAnswer);
    if (userStoryAnswer.keyDates) {
      parts.push(`Key Dates: ${userStoryAnswer.keyDates}`);
    }
    if (userStoryAnswer.keyPlaces) {
      parts.push(`Key Places: ${userStoryAnswer.keyPlaces}`);
    }
    parts.push('');
  }

  // Previous conversation context (last 2 turns for continuity)
  if (previousTurns.length > 0) {
    const recentTurns = previousTurns.slice(-2);
    parts.push(`=== PREVIOUS CONVERSATION ===`);
    for (const turn of recentTurns) {
      parts.push(`Q: ${turn.aiQuestion}`);
      parts.push(`A: ${turn.userAnswer}`);
      parts.push('');
    }
  }

  // Instructions for this turn
  if (turnNumber === 1) {
    parts.push(`=== YOUR TASK ===`);
    parts.push(`This is the first question. Ask the current question naturally.`);
    parts.push(`After the user answers, provide feedback and ask a relevant follow-up.`);
  } else {
    parts.push(`=== YOUR TASK ===`);
    parts.push(`The user has just answered the previous question.`);
    parts.push(`1. Provide brief, gentle feedback on their answer`);
    parts.push(`2. Ask the follow-up question listed below`);
    parts.push(`Current follow-up to ask: "${question.prompt}"`);
  }

  parts.push('');
  parts.push(`Remember: Respond ONLY with the JSON format specified in your system instructions.`);

  return parts.join('\n');
}

/**
 * Build prompt for follow-up question selection
 */
export function buildFollowUpPrompt(
  previousQuestion: string,
  userAnswer: string,
  availableFollowUps: string[]
): string {
  const parts: string[] = [];

  parts.push(`=== PREVIOUS QUESTION ===`);
  parts.push(previousQuestion);
  parts.push('');
  parts.push(`=== USER'S ANSWER ===`);
  parts.push(userAnswer);
  parts.push('');
  parts.push(`=== AVAILABLE FOLLOW-UP QUESTIONS ===`);
  availableFollowUps.forEach((q, i) => {
    parts.push(`${i + 1}. ${q}`);
  });
  parts.push('');
  parts.push(`Select the most relevant follow-up question based on the user's answer.`);
  parts.push(`Respond with just the question number (1-${availableFollowUps.length}).`);

  return parts.join('\n');
}

// ============================================================================
// FEEDBACK PROMPTS
// ============================================================================

/**
 * Build a prompt specifically for feedback generation
 */
export function buildFeedbackPrompt(
  question: string,
  sampleAnswer: string | undefined,
  userAnswer: string,
  officerLookingFor: string[]
): string {
  const parts: string[] = [];

  parts.push(`=== INTERVIEW QUESTION ===`);
  parts.push(question);
  parts.push('');

  if (sampleAnswer) {
    parts.push(`=== SAMPLE ANSWER (FOR REFERENCE) ===`);
    parts.push(sampleAnswer);
    parts.push('');
  }

  parts.push(`=== WHAT OFFICERS LOOK FOR ===`);
  parts.push(officerLookingFor.join('; '));
  parts.push('');

  parts.push(`=== USER'S ANSWER ===`);
  parts.push(userAnswer);
  parts.push('');

  parts.push(`=== YOUR TASK ===`);
  parts.push(`Provide gentle, constructive feedback on this answer.`);
  parts.push(`Be encouraging but honest about areas for improvement.`);
  parts.push(`Keep feedback to 1-2 sentences.`);

  return parts.join('\n');
}

// ============================================================================
// TOPIC-SPECIFIC PROMPTS
// ============================================================================

/**
 * Get topic-specific guidance
 */
export function getTopicGuidance(topicTitle: string): string {
  const lowerTitle = topicTitle.toLowerCase();

  if (lowerTitle.includes('kitchen') || lowerTitle.includes('household')) {
    return 'Focus on specific details: locations of items, brands, routines. Officers verify couples know their shared space.';
  }

  if (lowerTitle.includes('daily') || lowerTitle.includes('routine')) {
    return 'Ask about schedules, habits, and who does what. Look for natural, consistent details about shared life.';
  }

  if (lowerTitle.includes('relationship') || lowerTitle.includes('timeline')) {
    return 'These are high-stakes questions. Ensure dates and stories align. Ask for specific memories.';
  }

  if (lowerTitle.includes('family') || lowerTitle.includes('in-law')) {
    return 'Verify genuine family integration. Ask about names, locations, recent interactions.';
  }

  if (lowerTitle.includes('financ') || lowerTitle.includes('money') || lowerTitle.includes('bill')) {
    return 'Financial co-mingling is critical evidence. Ask specific amounts, account details, who pays what.';
  }

  if (lowerTitle.includes('red flag') || lowerTitle.includes('sensitive')) {
    return 'Approach carefully. These questions can cause anxiety. Be extra gentle and supportive.';
  }

  return 'Ask naturally, one question at a time. Look for specific, consistent details.';
}

// ============================================================================
// JSON SCHEMA FOR STRUCTURED OUTPUT
// ============================================================================

/**
 * JSON schema for structured AI responses
 * Use with providers that support JSON schema (OpenAI, some Anthropic models)
 */
export const INTERVIEW_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    feedbackSummary: {
      type: 'string',
      description: 'Brief encouraging feedback on the user\'s answer (1-2 sentences)',
    },
    feedbackLabel: {
      type: 'string',
      enum: ['clear_and_natural', 'could_use_more_detail', 'worth_reviewing_together', 'a_little_vague', 'review_gently'],
      description: 'The feedback category that best describes the answer',
    },
    followUpQuestion: {
      type: 'string',
      description: 'The next interview question to ask the user',
    },
    suggestedReviewTopics: {
      type: 'array',
      items: { type: 'string' },
      description: 'Optional list of topics the user should review',
    },
    explanation: {
      type: 'string',
      description: 'Brief context on why the current question matters (optional)',
    },
  },
  required: ['feedbackSummary', 'feedbackLabel', 'followUpQuestion'],
  additionalProperties: false,
};

// ============================================================================
// FALLBACK RESPONSES
// ============================================================================

/**
 * Fallback response when AI fails
 */
export function getFallbackResponse(): {
  feedbackSummary: string;
  feedbackLabel: FeedbackLabel;
  followUpQuestion: string;
} {
  return {
    feedbackSummary: "Thanks for your answer. Let's continue with the next question.",
    feedbackLabel: 'clear_and_natural',
    followUpQuestion: 'Can you tell me more about your daily routine together?',
  };
}

/**
 * Error response when AI is unavailable
 */
export function getErrorResponse(): {
  feedbackSummary: string;
  feedbackLabel: FeedbackLabel;
  followUpQuestion: string;
} {
  return {
    feedbackSummary: "I'm having trouble processing your answer. Let's try a different question.",
    feedbackLabel: 'review_gently',
    followUpQuestion: 'What time did you both wake up this morning?',
  };
}
