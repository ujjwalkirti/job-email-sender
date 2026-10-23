import { generateInitialEmail } from '../generator/templates.js';
import {
  validateEmail,
  validateWordCount,
  validateSubject,
  validateHook,
  validateClosingQuestion
} from '../generator/validator.js';

/**
 * ANSI Color Palette for Terminal UI.
 */
export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

const c = colors;

/**
 * Creates a stylized pass/fail badge.
 *
 * @param {string} text
 * @param {boolean} pass
 * @returns {string}
 */
export function badge(text, pass) {
  if (pass) {
    return `${c.green}${c.bold}[PASS: ${text}]${c.reset}`;
  }
  return `${c.red}${c.bold}[FAIL: ${text}]${c.reset}`;
}

/**
 * Generates email draft and computes real-time compliance metrics.
 *
 * @param {object} startup
 * @param {object} contact
 * @param {object} [senderProfile]
 * @returns {object} Draft preview object with metrics and pass/fail indicators
 */
export function generateDraftPreview(startup, contact, senderProfile = {}) {
  const email = generateInitialEmail(startup, contact, senderProfile);

  const words = email.bodyText.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const wordCountRes = validateWordCount(email.bodyText);

  const subjectLength = email.subject.trim().length;
  const subjectRes = validateSubject(email.subject);

  // Extract first sentence after greeting
  const lines = email.bodyText.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const salutationRegex = /^(?:hi|hello|hey|dear)\s+[a-z\-'’]+(?:\s+[a-z\-'’]+)?[,!:]?$/i;
  let targetLine = lines[0];
  if (salutationRegex.test(targetLine) && lines.length > 1) {
    targetLine = lines[1];
  }
  const sentences = targetLine.split(/(?<=[.!?])\s+/);
  const firstSentence = sentences[0] || targetLine;

  const hookRes = validateHook(
    firstSentence,
    startup?.name || '',
    startup?.roundAmount || startup?.productDescription || ''
  );

  const closingRes = validateClosingQuestion(email.bodyText);
  const fullValidation = validateEmail({
    subject: email.subject,
    bodyText: email.bodyText,
    startupName: startup?.name || '',
    productOrRaise: startup?.roundAmount || ''
  });

  const overallValid = fullValidation.valid &&
    wordCountRes.valid &&
    subjectRes.valid &&
    hookRes.valid &&
    closingRes.valid;

  return {
    startup,
    contact,
    email,
    metrics: {
      subjectLength,
      subjectValid: subjectRes.valid,
      subjectError: subjectRes.error,
      wordCount,
      wordCountValid: wordCountRes.valid,
      wordCountError: wordCountRes.error,
      hookSentence: firstSentence,
      hookValid: hookRes.valid,
      hookError: hookRes.error,
      closingValid: closingRes.valid,
      closingError: closingRes.error
    },
    validation: fullValidation,
    overallValid
  };
}

/**
 * Formats a single draft preview into a terminal-friendly card.
 *
 * @param {object} startup
 * @param {object} contact
 * @param {object} [senderProfile]
 * @param {object} [options]
 * @param {boolean} [options.showBody=true]
 * @param {boolean} [options.plain=false] - If true, strips ANSI colors
 * @returns {string} Formatted preview card
 */
export function formatDraftPreview(startup, contact, senderProfile = {}, options = {}) {
  const preview = generateDraftPreview(startup, contact, senderProfile);
  const { metrics, overallValid, email } = preview;

  const subjectBadge = badge(`${metrics.subjectLength} chars`, metrics.subjectValid);
  const wordBadge = badge(`${metrics.wordCount} words`, metrics.wordCountValid);
  const hookBadge = badge(metrics.hookValid ? 'Company/Raise Hook' : 'Hook Issue', metrics.hookValid);
  const closingBadge = badge(metrics.closingValid ? 'Exact Question' : 'Missing Question', metrics.closingValid);

  const gateBadge = overallValid
    ? `${c.bgGreen}${c.white}${c.bold} PASS - ALL GATES SATISFIED ${c.reset}`
    : `${c.bgRed}${c.white}${c.bold} FAIL - CONSTRAINTS VIOLATED ${c.reset}`;

  const border = '═'.repeat(78);
  const divider = '─'.repeat(78);

  const header = `${c.cyan}${c.bold}STARTUP:${c.reset} ${startup.name || 'Unnamed'} (${startup.fundingRound || 'Seed'} ${startup.roundAmount || ''})  ${c.gray}|${c.reset}  ${c.cyan}${c.bold}CONTACT:${c.reset} ${contact.name} [${contact.role}] <${contact.email}>`;

  let card = `
${c.blue}${border}${c.reset}
${header}
${c.blue}${divider}${c.reset}
${c.bold}Subject Line:${c.reset}    "${email.subject}"
                 -> ${c.dim}Length:${c.reset} ${metrics.subjectLength} / [36-50] chars ${subjectBadge}
${c.bold}Word Count:${c.reset}      ${metrics.wordCount} / [90-120] words ${wordBadge}
${c.bold}Line 1 Hook:${c.reset}     "${metrics.hookSentence}"
                 -> ${hookBadge}
${c.bold}Closing Call:${c.reset}   "What are you struggling to hire for right now?"
                 -> ${closingBadge}
${c.bold}Overall Gate:${c.reset}   ${gateBadge}`;

  if (options.showBody !== false) {
    card += `\n${c.blue}${divider}${c.reset}
${c.bold}Generated Body Text:${c.reset}
${c.dim}${email.bodyText}${c.reset}`;
  }

  card += `\n${c.blue}${border}${c.reset}\n`;

  if (options.plain) {
    return card.replace(/\x1b\[[0-9;]*m/g, '');
  }

  return card;
}

/**
 * Prints a single draft preview to stdout.
 *
 * @param {object} startup
 * @param {object} contact
 * @param {object} [senderProfile]
 * @param {object} [options]
 */
export function printDraftPreview(startup, contact, senderProfile = {}, options = {}) {
  const output = formatDraftPreview(startup, contact, senderProfile, options);
  console.log(output);
}

/**
 * Previews all drafts in a campaign with real-time stats and tally.
 *
 * @param {object} campaignData - CampaignData or CampaignStore
 * @param {object} [senderProfile]
 * @param {object} [options]
 * @param {string} [options.startupFilter]
 * @param {string} [options.statusFilter]
 * @param {number} [options.limit]
 * @param {boolean} [options.showBody=false]
 * @returns {{ total: number, passed: number, failed: number }}
 */
export function previewCampaign(campaignData, senderProfile = {}, options = {}) {
  const startups = campaignData?.startups || campaignData?.data?.startups || [];
  let total = 0;
  let passed = 0;
  let failed = 0;

  const { startupFilter, statusFilter, limit = 50, showBody = true } = options;

  console.log(`\n${c.bold}${c.cyan}╔══════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}${c.cyan}║           COLD OUTREACH ENGINE - INTERACTIVE DRAFT PREVIEW                   ║${c.reset}`);
  console.log(`${c.bold}${c.cyan}╚══════════════════════════════════════════════════════════════════════════════╝${c.reset}\n`);

  for (const startup of startups) {
    if (startupFilter && !startup.name?.toLowerCase().includes(startupFilter.toLowerCase())) {
      continue;
    }

    for (const contact of startup.contacts || []) {
      if (statusFilter && (contact.status || 'QUEUED').toUpperCase() !== statusFilter.toUpperCase()) {
        continue;
      }

      total++;
      const preview = generateDraftPreview(startup, contact, senderProfile);

      if (preview.overallValid) {
        passed++;
      } else {
        failed++;
      }

      printDraftPreview(startup, contact, senderProfile, { showBody });

      if (total >= limit) {
        break;
      }
    }

    if (total >= limit) {
      break;
    }
  }

  const allPass = failed === 0 && total > 0;
  const statusColor = allPass ? c.green : c.red;
  const statusText = allPass ? 'ALL DRAFTS PASS STRICT GATES' : 'SOME DRAFTS FAILED GATES';

  console.log(`\n${statusColor}╔══════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${statusColor}║ CAMPAIGN PREVIEW SUMMARY: ${total} drafts evaluated                            ║${c.reset}`);
  console.log(`${statusColor}║ Passed: ${passed} / ${total} | Failed: ${failed} / ${total}                                       ║${c.reset}`);
  console.log(`${statusColor}║ Status: ${statusText.padEnd(61)} ║${c.reset}`);
  console.log(`${statusColor}╚══════════════════════════════════════════════════════════════════════════════╝${c.reset}\n`);

  return { total, passed, failed };
}
