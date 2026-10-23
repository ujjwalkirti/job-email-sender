/**
 * Strict Constraint Validator for Cold Outreach Engine.
 *
 * Enforces compliance rules:
 * 1. Word count: strictly 90 to 120 words.
 * 2. Subject line length: strictly 36 to 50 characters.
 * 3. Line 1 hook: Must be about their raise, company, or product; never about the sender.
 * 4. Closing question: Exact presence of "What are you struggling to hire for right now?".
 * 5. Attachments: Strictly zero attachments (no resume).
 */

const MIN_WORDS = 90;
const MAX_WORDS = 120;
const MIN_SUBJECT_LENGTH = 36;
const MAX_SUBJECT_LENGTH = 50;
const CLOSING_QUESTION_REGEX = /what are you struggling to hire for right now\?/i;

const SENDER_PATTERNS = [
  /\bmy name is\b/i,
  /\bi am\b/i,
  /\bi'm\b/i,
  /\bi wanted to\b/i,
  /\bi noticed\b/i,
  /\bi reached out\b/i,
  /\bi am reaching\b/i,
  /\bi'm reaching\b/i,
  /\breaching out\b/i,
  /\bintroduce myself\b/i,
  /\bi saw your\b/i,
  /\bi found your\b/i,
  /\bi came across\b/i,
  /\bmy background\b/i,
  /\bi would like to\b/i,
  /\bi would love to introduce\b/i,
  /\bi am writing\b/i,
  /\bi'm writing\b/i,
  /\bi have been following\b/i,
  /\bi've been following\b/i,
  /\bi hope this email finds you\b/i,
  /\bi hope you(?:'re| are) doing well\b/i
];

/**
 * Validates that text has strictly between 90 and 120 words.
 *
 * @param {string} text - Email body text (plain text or HTML)
 * @returns {{ valid: boolean, count: number, error?: string }}
 */
export function validateWordCount(text) {
  if (typeof text !== 'string') {
    return {
      valid: false,
      count: 0,
      error: 'Body text must be a string'
    };
  }

  // Strip HTML tags if present, replacing with space to prevent word joining
  const plainText = text.replace(/<[^>]*>/g, ' ');
  const words = plainText.trim().split(/\s+/).filter(Boolean);
  const count = words.length;

  if (count < MIN_WORDS || count > MAX_WORDS) {
    return {
      valid: false,
      count,
      error: `Word count must be strictly between ${MIN_WORDS} and ${MAX_WORDS} words (got ${count})`
    };
  }

  return {
    valid: true,
    count
  };
}

/**
 * Validates that subject line length is strictly between 36 and 50 characters.
 *
 * @param {string} subject - Email subject line
 * @returns {{ valid: boolean, length: number, error?: string }}
 */
export function validateSubject(subject) {
  if (typeof subject !== 'string') {
    return {
      valid: false,
      length: 0,
      error: 'Subject must be a string'
    };
  }

  const length = subject.trim().length;

  if (length < MIN_SUBJECT_LENGTH || length > MAX_SUBJECT_LENGTH) {
    return {
      valid: false,
      length,
      error: `Subject length must be strictly between ${MIN_SUBJECT_LENGTH} and ${MAX_SUBJECT_LENGTH} characters (got ${length})`
    };
  }

  return {
    valid: true,
    length
  };
}

/**
 * Validates that the hook (first sentence) is about the startup's raise, company,
 * or product and not about the sender.
 *
 * @param {string} firstSentence - First sentence of email
 * @param {string} [startupName] - Target startup name
 * @param {string} [productOrRaise] - Product description or funding round info
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateHook(firstSentence, startupName = '', productOrRaise = '') {
  if (typeof firstSentence !== 'string' || !firstSentence.trim()) {
    return {
      valid: false,
      error: 'Hook sentence is required'
    };
  }

  const lowerSentence = firstSentence.toLowerCase();

  // 1. Check for sender-centric introductory phrases
  const hasSenderIntro = SENDER_PATTERNS.some(pattern => pattern.test(lowerSentence));
  if (hasSenderIntro) {
    return {
      valid: false,
      error: 'Hook must be about their company, raise, or product, not about the sender'
    };
  }

  // 2. Check for reference to startup, raise, or product
  const lowerStartup = (startupName || '').trim().toLowerCase();
  const lowerProductOrRaise = (productOrRaise || '').trim().toLowerCase();

  const mentionsStartup = Boolean(lowerStartup && lowerSentence.includes(lowerStartup));

  let mentionsProductOrRaise = false;
  if (lowerProductOrRaise) {
    if (lowerSentence.includes(lowerProductOrRaise)) {
      mentionsProductOrRaise = true;
    } else {
      const tokens = lowerProductOrRaise
        .split(/[\s,]+/)
        .map(t => t.trim())
        .filter(t => t.length > 2 || /\d/.test(t));
      if (tokens.length > 0 && tokens.some(t => lowerSentence.includes(t))) {
        mentionsProductOrRaise = true;
      }
    }
  }

  const hasRaiseOrProductKeywords = /\b(seed|series\s+[a-z]|round|raise|raised|funding|funded|product|platform|workflow|engine|app|build|scale)\b/i.test(lowerSentence);

  if (lowerStartup || lowerProductOrRaise) {
    if (!mentionsStartup && !mentionsProductOrRaise) {
      return {
        valid: false,
        error: 'Hook must reference the startup name, recent raise, or product'
      };
    }
  } else if (!hasRaiseOrProductKeywords) {
    return {
      valid: false,
      error: 'Hook must reference their recent raise, company, or product'
    };
  }

  return {
    valid: true
  };
}

/**
 * Validates presence of the exact closing question:
 * "What are you struggling to hire for right now?"
 *
 * @param {string} text - Email body text
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateClosingQuestion(text) {
  if (typeof text !== 'string') {
    return {
      valid: false,
      error: 'Text must be a string'
    };
  }

  if (!CLOSING_QUESTION_REGEX.test(text)) {
    return {
      valid: false,
      error: 'Email must include the closing question: "What are you struggling to hire for right now?"'
    };
  }

  return {
    valid: true
  };
}

/**
 * Validates that there are no attachments included.
 *
 * @param {object} [options] - Options object containing attachments
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateNoAttachment(options = {}) {
  if (options && options.attachments && Array.isArray(options.attachments) && options.attachments.length > 0) {
    return {
      valid: false,
      error: 'Emails must not contain attachments (no resume attached)'
    };
  }

  return {
    valid: true
  };
}

/**
 * Extracts the first sentence from email body text, skipping any simple greeting line.
 *
 * @param {string} text
 * @returns {string}
 */
function extractFirstSentence(text) {
  if (typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return '';

  // Salutation pattern: "Hi Alex," or "Hey Sarah,"
  const salutationRegex = /^(?:hi|hello|hey|dear)\s+[a-z]{1,20}(?:\s+[a-z]{1,20})?[,:]?$/i;
  let targetLine = lines[0];
  if (salutationRegex.test(targetLine) && lines.length > 1) {
    targetLine = lines[1];
  }

  const sentences = targetLine.split(/(?<=[.!?])\s+/);
  return sentences[0] || targetLine;
}

/**
 * Aggregated email validator verifying all strict constraints.
 *
 * @param {object} emailObj
 * @param {string} emailObj.subject
 * @param {string} emailObj.bodyText
 * @param {any[]} [emailObj.attachments]
 * @param {string} [emailObj.startupName]
 * @param {string} [emailObj.productOrRaise]
 * @returns {{ valid: boolean, errors: string[], metrics: { wordCount: number, subjectLength: number } }}
 */
export function validateEmail({
  subject = '',
  bodyText = '',
  attachments = [],
  startupName = '',
  productOrRaise = ''
} = {}) {
  const errors = [];

  const wordCountRes = validateWordCount(bodyText);
  if (!wordCountRes.valid && wordCountRes.error) {
    errors.push(wordCountRes.error);
  }

  const subjectRes = validateSubject(subject);
  if (!subjectRes.valid && subjectRes.error) {
    errors.push(subjectRes.error);
  }

  const firstSentence = extractFirstSentence(bodyText);
  const hookRes = validateHook(firstSentence, startupName, productOrRaise);
  if (!hookRes.valid && hookRes.error) {
    errors.push(hookRes.error);
  }

  const closingRes = validateClosingQuestion(bodyText);
  if (!closingRes.valid && closingRes.error) {
    errors.push(closingRes.error);
  }

  const attachmentRes = validateNoAttachment({ attachments });
  if (!attachmentRes.valid && attachmentRes.error) {
    errors.push(attachmentRes.error);
  }

  return {
    valid: errors.length === 0,
    errors,
    metrics: {
      wordCount: wordCountRes.count,
      subjectLength: subjectRes.length
    }
  };
}
