import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Mailer wraps Nodemailer with dry-run safety and jitter/rate-limiting delay
 * between dispatches to protect domain reputation and avoid spam filters.
 */
export class Mailer {
  /**
   * @param {object} [options]
   * @param {boolean} [options.dryRun] - When true, bypasses actual SMTP dispatch
   * @param {object} [options.transport] - Custom nodemailer transporter instance
   * @param {number} [options.minDelayMs=1000] - Minimum delay between sends in ms
   * @param {number} [options.maxDelayMs=3000] - Maximum delay between sends in ms
   * @param {string} [options.from] - Sender email address
   */
  constructor(options = {}) {
    this.dryRun = options.dryRun ?? (process.env.DRY_RUN === 'true' || process.env.NODE_ENV === 'test');
    this.minDelayMs = options.minDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 3000;
    this.from = options.from || process.env.EMAIL_USERNAME || 'sender@example.com';
    this.sentLog = [];
    this.lastSendTimestamp = 0;

    if (options.transport) {
      this.transporter = options.transport;
    } else if (!this.dryRun && process.env.EMAIL_USERNAME && process.env.PASSWORD) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.PASSWORD
        }
      });
    } else {
      this.transporter = null;
    }
  }

  /**
   * Calculates random jitter delay between minDelayMs and maxDelayMs.
   *
   * @returns {number} Delay in milliseconds
   */
  getJitterDelay() {
    if (this.maxDelayMs <= 0) return 0;
    if (this.maxDelayMs <= this.minDelayMs) return this.minDelayMs;
    return Math.floor(Math.random() * (this.maxDelayMs - this.minDelayMs + 1)) + this.minDelayMs;
  }

  /**
   * Waits for a jitter delay before sending the next message.
   *
   * @returns {Promise<number>} Number of milliseconds delayed
   */
  async waitJitter() {
    const delay = this.getJitterDelay();
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    return delay;
  }

  /**
   * Dispatches an individual email message or logs it safely in dryRun mode.
   *
   * @param {object} emailParams
   * @param {string} emailParams.to - Recipient email
   * @param {string} emailParams.subject - Email subject
   * @param {string} [emailParams.html] - HTML formatted body
   * @param {string} [emailParams.text] - Plain text body
   * @param {string} [emailParams.from] - Sender address override
   * @param {string} [emailParams.inReplyTo] - Message-ID for thread preservation
   * @param {string} [emailParams.references] - Thread references
   * @returns {Promise<{
   *   success: boolean,
   *   dryRun: boolean,
   *   messageId: string,
   *   to: string,
   *   subject: string,
   *   html?: string,
   *   text?: string,
   *   from: string,
   *   timestamp: string,
   *   delayAppliedMs: number,
   *   response?: any,
   *   error?: string
   * }>}
   */
  async sendEmail({ to, subject, html, text, from, inReplyTo, references }) {
    if (!to || !subject) {
      throw new Error('Email recipient (to) and subject are required');
    }

    const delayAppliedMs = await this.waitJitter();
    const sender = from || this.from;
    const timestamp = new Date().toISOString();

    if (this.dryRun || !this.transporter) {
      const result = {
        success: true,
        dryRun: true,
        messageId: `dryrun-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        to,
        subject,
        html,
        text,
        from: sender,
        timestamp,
        delayAppliedMs
      };

      this.sentLog.push(result);
      this.lastSendTimestamp = Date.now();
      return result;
    }

    const mailOptions = {
      from: sender,
      to,
      subject,
      html,
      text
    };

    if (inReplyTo) mailOptions.inReplyTo = inReplyTo;
    if (references) mailOptions.references = references;

    try {
      const info = await this.transporter.sendMail(mailOptions);
      const result = {
        success: true,
        dryRun: false,
        messageId: info.messageId,
        response: info.response,
        to,
        subject,
        html,
        text,
        from: sender,
        timestamp,
        delayAppliedMs
      };

      this.sentLog.push(result);
      this.lastSendTimestamp = Date.now();
      return result;
    } catch (err) {
      const failure = {
        success: false,
        dryRun: false,
        error: err.message,
        to,
        subject,
        from: sender,
        timestamp,
        delayAppliedMs
      };
      this.sentLog.push(failure);
      throw err;
    }
  }

  /**
   * Dispatches a batch of emails sequentially with jitter delay between each.
   *
   * @param {Array<object>} emails
   * @returns {Promise<Array<object>>}
   */
  async sendBatch(emails) {
    const results = [];
    for (const email of emails) {
      const res = await this.sendEmail(email);
      results.push(res);
    }
    return results;
  }
}
