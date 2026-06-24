/**
 * Answer Sanitization Service
 * 
 * Removes or generalizes sensitive personal information from user answers
 * before they enter the example candidate pipeline.
 * 
 * This is a rule-based system (not perfect NLP) that handles common PII patterns.
 * When in doubt, we err on the side of over-sanitization.
 */

// Patterns to detect and replace
const SENSITIVE_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
  replacement: string | ((match: string) => string);
  priority: number; // Higher = processed first
}> = [
  // Case numbers and A-numbers (immigration identifiers)
  {
    name: 'case_number',
    pattern: /\b[A-Z]{2,4}\d{7,12}\b|\b[A-Z]{3}\s*\d{4,10}\b|\b\d{3}[A-Z]\d{6,10}\b/gi,
    replacement: '[CASE-NUMBER-REMOVED]',
    priority: 100,
  },
  {
    name: 'a_number',
    pattern: /\bA\s*[-#]?\s*\d{7,9}\b|\bA[-#]\d{8,9}\b/gi,
    replacement: '[A-NUMBER-REMOVED]',
    priority: 100,
  },
  {
    name: 'receipt_number',
    pattern: /\b(MSC|LIN|EAC|WAC|YSC|IOE)\d{10}\b/gi,
    replacement: '[RECEIPT-NUMBER-REMOVED]',
    priority: 100,
  },
  
  // Email addresses
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL-REMOVED]',
    priority: 90,
  },
  
  // Phone numbers (various formats)
  {
    name: 'phone',
    pattern: /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g,
    replacement: '[PHONE-REMOVED]',
    priority: 90,
  },
  
  // Social Security Numbers
  {
    name: 'ssn',
    pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
    replacement: '[SSN-REMOVED]',
    priority: 100,
  },
  
  // Addresses - street numbers and specific streets
  {
    name: 'street_address',
    pattern: /\b\d+\s+(North|South|East|West|N|S|E|W)?\s*[A-Za-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl|Circle|Cir)\b/gi,
    replacement: '[ADDRESS-REMOVED]',
    priority: 80,
  },
  {
    name: 'apartment_number',
    pattern: /\b(Apt|Apartment|Unit|Suite|#)\s*[#.]?\s*\w+\b/gi,
    replacement: '',
    priority: 80,
  },
  
  // Zip codes (can be identifying)
  {
    name: 'zip_code',
    pattern: /\b\d{5}(-\d{4})?\b/g,
    replacement: '[ZIP-REMOVED]',
    priority: 70,
  },
];

// Names to replace with generic terms
// This is a conservative list - we only replace when we're confident it's a name
const COMMON_NAMES_PATTERN = new RegExp(
  `\\b(John|Jane|Michael|Mike|Sarah|David|Emily|Emma|James|Jennifer|Jen|Robert|Bob|Lisa|William|Bill|Maria|Mary|Mark|Patricia|Pat|Thomas|Tom|Linda|Charles|Charlie|Barbara|Chris|Christopher|Elizabeth|Liz|Daniel|Dan|Susan|Susan|Susan|Jessica|Jess|Matthew|Matt|Ashley|Joseph|Joe|Karen|Andrew|Andy|Nancy|Kevin|Betty|Brian|Helen|Jason|Sandra|Jeffrey|Donna|Ryan|Carol|Jacob|Ruth|Gary|Sharon|Nicholas|Nick|Michelle|Eric|Laura|Jonathan|Sarah|Stephen|Kimberly|Kim|Larry|Deborah|Benjamin|Ben|Dorothy|Samuel|Sam|Amy|Patrick|Angela|Alexander|Alex|Anna|Henry|Brenda)\\b`,
  'gi'
);

// Specific date patterns that might be too identifying
const SPECIFIC_DATE_PATTERN = /\b(on\s+)?(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[\.\s]+\d{1,2}[,.\s]+\d{4}\b/gi;
// Year-only pattern reserved for future use if needed

/**
 * Sanitize an answer by removing PII
 * 
 * @param originalAnswer The user's original answer
 * @returns Sanitized version safe for review
 */
export function sanitizeAnswer(originalAnswer: string): string {
  if (!originalAnswer || originalAnswer.trim().length === 0) {
    return originalAnswer;
  }

  let sanitized = originalAnswer;

  // Sort patterns by priority (highest first)
  const sortedPatterns = [...SENSITIVE_PATTERNS].sort((a, b) => b.priority - a.priority);

  // Apply each pattern
  for (const { name, pattern, replacement } of sortedPatterns) {
    try {
      if (typeof replacement === 'string') {
        sanitized = sanitized.replace(pattern, replacement);
      } else {
        sanitized = sanitized.replace(pattern, replacement);
      }
    } catch (e) {
      // If a pattern fails, continue with others
      console.warn(`[AnswerSanitizer] Pattern ${name} failed:`, e);
    }
  }

  // Replace specific dates with just the year or general time reference
  sanitized = sanitized.replace(SPECIFIC_DATE_PATTERN, (match) => {
    // Extract year from the match
    const yearMatch = match.match(/\d{4}/);
    if (yearMatch) {
      return `in ${yearMatch[0]}`;
    }
    return '[DATE-REMOVED]';
  });

  // Replace common first names with generic references
  // Only do this for clear name patterns, not common words
  sanitized = sanitized.replace(COMMON_NAMES_PATTERN, (match, offset, string) => {
    // Check if it's likely a name (capitalized, preceded by common name indicators)
    const before = string.slice(Math.max(0, offset - 30), offset).toLowerCase();
    const nameIndicators = ['my name is', 'i am', 'i\'m', 'name is', 'called', 'is named', 'named'];
    
    if (nameIndicators.some(indicator => before.includes(indicator))) {
      return 'my spouse';
    }
    
    // Check if followed by a surname indicator
    const after = string.slice(offset + match.length, offset + match.length + 30).toLowerCase();
    if (after.includes('and i') || after.includes('my spouse') || after.includes('we')) {
      return 'my spouse';
    }
    
    // If uncertain, keep the name to avoid over-sanitizing
    return match;
  });

  // Clean up any artifacts
  sanitized = cleanupArtifacts(sanitized);

  return sanitized;
}

/**
 * Clean up common artifacts from sanitization
 */
function cleanupArtifacts(text: string): string {
  return text
    // Remove double spaces
    .replace(/\s{2,}/g, ' ')
    // Remove spaces before punctuation
    .replace(/\s+([.,;:!?])/g, '$1')
    // Fix spacing around brackets
    .replace(/\[\s+/g, '[')
    .replace(/\s+\]/g, ']')
    // Remove empty brackets or repetitive removals
    .replace(/\s*\[ADDRESS-REMOVED\]\s*\[ADDRESS-REMOVED\]\s*/g, ' [ADDRESS-REMOVED] ')
    .replace(/\s*\[EMAIL-REMOVED\]\s*\[EMAIL-REMOVED\]\s*/g, ' [EMAIL-REMOVED] ')
    // Trim
    .trim();
}

/**
 * Check if an answer likely contains PII
 * Useful for logging or flagging
 */
export function containsPII(answer: string): {
  hasPII: boolean;
  detectedTypes: string[];
} {
  const detectedTypes: string[] = [];

  for (const { name, pattern } of SENSITIVE_PATTERNS) {
    if (pattern.test(answer)) {
      detectedTypes.push(name);
    }
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
  }

  return {
    hasPII: detectedTypes.length > 0,
    detectedTypes,
  };
}

/**
 * Get a summary of what was sanitized
 */
export function getSanitizationSummary(
  original: string,
  sanitized: string
): {
  wasChanged: boolean;
  originalLength: number;
  sanitizedLength: number;
  reductionPercent: number;
} {
  const originalLength = original.length;
  const sanitizedLength = sanitized.length;
  const wasChanged = original !== sanitized;
  const reductionPercent = originalLength > 0
    ? Math.round(((originalLength - sanitizedLength) / originalLength) * 100)
    : 0;

  return {
    wasChanged,
    originalLength,
    sanitizedLength,
    reductionPercent,
  };
}
