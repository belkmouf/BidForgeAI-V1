/**
 * Input sanitization library for AI prompts
 * Protects against prompt injection and malicious input
 */

export class InputSanitizationError extends Error {
  constructor(message: string, public readonly reason: string) {
    super(message);
    this.name = 'InputSanitizationError';
  }
}

// Patterns that indicate prompt injection attempts
const INJECTION_PATTERNS = [
  // Instruction hijacking
  /ignore\s+(all\s+|previous\s+)?instructions?/gi,
  /disregard\s+(all\s+|previous\s+)?instructions?/gi,
  /forget\s+(your\s+|all\s+)?role/gi,
  /override\s+(all\s+|previous\s+)?instructions?/gi,
  
  // System prompt manipulation
  /---end\s+(system\s+)?prompt---/gi,
  /\[system\]/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /\{%\s*system\s*%\}/gi,
  /<\|system\|>/gi,
  
  // Privilege escalation
  /act\s+as\s+(sudo|admin|root|developer|god)/gi,
  /you\s+are\s+now\s+(a\s+)?(sudo|admin|root|developer)/gi,
  /elevated\s+privileges/gi,
  
  // Jailbreak attempts
  /DAN\s+mode/gi,
  /developer\s+mode/gi,
  /god\s+mode/gi,
  /jailbreak/gi,
  /do\s+anything\s+now/gi,
  
  // Information extraction
  /print\s+(your\s+)?system\s+prompt/gi,
  /reveal\s+(your\s+)?instructions/gi,
  /show\s+(me\s+)?your\s+rules/gi,
  /what\s+(are\s+)?your\s+instructions/gi,
  
  // Code execution attempts
  /exec\(|eval\(|system\(/gi,
  /import\s+os|import\s+sys/gi,
  /__import__|subprocess/gi,
];

// Characters that should never appear in legitimate input
const SUSPICIOUS_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export interface SanitizeOptions {
  maxLength?: number;
  allowMultiline?: boolean;
  strictMode?: boolean;
}

/**
 * Sanitize AI input to prevent prompt injection
 */
export function sanitizeAIInput(
  input: string, 
  options: SanitizeOptions = {}
): string {
  const {
    maxLength = 5000,
    allowMultiline = true,
    strictMode = true
  } = options;

  if (!input || typeof input !== 'string') {
    throw new InputSanitizationError(
      'Input must be a non-empty string',
      'INVALID_TYPE'
    );
  }

  let sanitized = input;

  // Remove control characters
  sanitized = sanitized.replace(SUSPICIOUS_CHARS, '');

  // Check for injection patterns
  if (strictMode) {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(sanitized)) {
        throw new InputSanitizationError(
          'Input contains suspicious patterns that may indicate prompt injection',
          'INJECTION_DETECTED'
        );
      }
    }
  } else {
    for (const pattern of INJECTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[removed]');
    }
  }

  // Limit excessive newlines
  if (!allowMultiline) {
    sanitized = sanitized.replace(/\n+/g, ' ');
  } else {
    sanitized = sanitized.replace(/\n{4,}/g, '\n\n\n');
  }

  sanitized = sanitized.trim();

  if (sanitized.length === 0) {
    throw new InputSanitizationError(
      'Input is empty after sanitization',
      'EMPTY_INPUT'
    );
  }

  if (sanitized.length > maxLength) {
    throw new InputSanitizationError(
      `Input too long. Maximum ${maxLength} characters allowed.`,
      'INPUT_TOO_LONG'
    );
  }

  return sanitized;
}

/**
 * Sanitize bid generation instructions
 */
export function sanitizeInstructions(instructions: string): string {
  return sanitizeAIInput(instructions, {
    maxLength: 5000,
    allowMultiline: true,
    strictMode: true
  });
}

/**
 * Sanitize tone parameter
 */
export function sanitizeTone(tone: string): string {
  return sanitizeAIInput(tone, {
    maxLength: 100,
    allowMultiline: false,
    strictMode: true
  });
}

/**
 * Sanitize feedback for bid refinement
 */
export function sanitizeFeedback(feedback: string): string {
  return sanitizeAIInput(feedback, {
    maxLength: 3000,
    allowMultiline: true,
    strictMode: true
  });
}

/**
 * Sanitize general text input
 */
export function sanitizeText(text: string, maxLength: number = 1000): string {
  return sanitizeAIInput(text, {
    maxLength,
    allowMultiline: true,
    strictMode: false
  });
}
