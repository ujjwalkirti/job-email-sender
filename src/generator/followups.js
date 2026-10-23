import { generateSubject, textToHtml } from './templates.js';

const DEFAULT_SENDER = {
  senderName: 'Ujjwal Kirti'
};

/**
 * Generates concise Day 4 follow-up under 45 words in the same thread.
 *
 * @param {object} startup - Startup info
 * @param {object} contact - Contact info
 * @param {string} [initialSubject] - Original subject line
 * @param {object} [senderProfile] - Sender info
 * @returns {{ subject: string, bodyText: string, html: string }}
 */
export function generateFollowup1(startup = {}, contact = {}, initialSubject = '', senderProfile = {}) {
  const senderName = senderProfile?.senderName || DEFAULT_SENDER.senderName;
  const firstName = (contact?.name || '').trim().split(/\s+/)[0] || 'there';
  const startupName = (startup?.name || 'your startup').trim();

  const baseSubject = initialSubject || generateSubject(startup, contact);
  const subject = /^re:\s*/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`;

  const bodyText = `Hi ${firstName},

Following up on my note regarding ${startupName}'s backend architecture.

Are you looking to hire a backend or distributed systems engineer to support your roadmap right now?

Best regards,
${senderName}`;

  const html = textToHtml(bodyText);

  return {
    subject,
    bodyText,
    html
  };
}

/**
 * Generates polite Day 9 follow-up under 40 words with stop condition.
 *
 * @param {object} startup - Startup info
 * @param {object} contact - Contact info
 * @param {string} [initialSubject] - Original subject line
 * @param {object} [senderProfile] - Sender info
 * @returns {{ subject: string, bodyText: string, html: string }}
 */
export function generateFollowup2(startup = {}, contact = {}, initialSubject = '', senderProfile = {}) {
  const senderName = senderProfile?.senderName || DEFAULT_SENDER.senderName;
  const firstName = (contact?.name || '').trim().split(/\s+/)[0] || 'there';
  const startupName = (startup?.name || 'your startup').trim();

  const baseSubject = initialSubject || generateSubject(startup, contact);
  const subject = /^re:\s*/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`;

  const bodyText = `Hi ${firstName},

Final note from me as I know you are busy building ${startupName}.

If backend or AI engineering becomes a priority later, feel free to reach out.

Best regards,
${senderName}`;

  const html = textToHtml(bodyText);

  return {
    subject,
    bodyText,
    html
  };
}
