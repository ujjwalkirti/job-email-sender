/**
 * Timezone Scheduler and Due Date Calculator for Cold Outreach Engine.
 *
 * Rules:
 * - Initial emails must be sent on Wednesday morning, between 9:00 AM and 11:00 AM,
 *   in the recipient's timezone (defaults to Asia/Kolkata).
 * - Follow-up 1 must be sent on Day 4 if no reply.
 * - Follow-up 2 must be sent on Day 9 if no reply, then stop forever.
 * - If contact is marked REPLIED or STOPPED, no further emails are sent.
 */

/**
 * Extracts zoned date and time components for a given Date and IANA timezone.
 *
 * @param {Date} date
 * @param {string} timeZone
 * @returns {{
 *   year: number,
 *   month: number,
 *   day: number,
 *   dayOfWeek: number,
 *   hour: number,
 *   minute: number,
 *   second: number
 * }}
 */
function getZonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const map = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let hour = parseInt(map.hour, 10);
  if (hour === 24) hour = 0;

  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10), // 1-12
    day: parseInt(map.day, 10),
    dayOfWeek: weekdayMap[map.weekday] ?? 0,
    hour,
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10)
  };
}

/**
 * Calculates the exact UTC Date corresponding to a specific local wall-clock
 * date/time in the target IANA timezone.
 *
 * @param {number} year
 * @param {number} month - 1-12
 * @param {number} day
 * @param {number} hour
 * @param {number} minute
 * @param {number} second
 * @param {string} timeZone
 * @returns {Date}
 */
function createZonedDate(year, month, day, hour, minute, second, timeZone) {
  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const guess = new Date(wallClockUtc);

  // Compute timezone offset by comparing formatted zoned components with UTC
  const zonedGuess = getZonedParts(guess, timeZone);
  const guessAsUtc = Date.UTC(
    zonedGuess.year,
    zonedGuess.month - 1,
    zonedGuess.day,
    zonedGuess.hour,
    zonedGuess.minute,
    zonedGuess.second
  );
  const offsetMs = guessAsUtc - guess.getTime();

  const exactDate = new Date(wallClockUtc - offsetMs);

  // Refine for any DST or boundary shifts
  const actualZoned = getZonedParts(exactDate, timeZone);
  const actualAsUtc = Date.UTC(
    actualZoned.year,
    actualZoned.month - 1,
    actualZoned.day,
    actualZoned.hour,
    actualZoned.minute,
    actualZoned.second
  );
  const diff = wallClockUtc - actualAsUtc;
  if (diff !== 0) {
    exactDate.setTime(exactDate.getTime() + diff);
  }

  return exactDate;
}

/**
 * Calculates the next Wednesday morning send time between 9:00 AM and 11:00 AM
 * in the recipient's timezone.
 *
 * Defaults to 9:30 AM local time, which lands comfortably within the 9-11 AM window.
 *
 * @param {string} [timezone='Asia/Kolkata'] - IANA timezone identifier
 * @param {Date | string} [fromDate=new Date()] - Reference base date
 * @returns {Date} Target UTC send date
 */
export function getNextWednesdaySendTime(timezone = 'Asia/Kolkata', fromDate = new Date()) {
  const tz = timezone || 'Asia/Kolkata';
  const base = fromDate ? new Date(fromDate) : new Date();
  const validBase = isNaN(base.getTime()) ? new Date() : base;

  const current = getZonedParts(validBase, tz);
  const WEDNESDAY = 3;

  let daysToAdd = 0;
  let targetHour = 9;
  let targetMinute = 30;

  if (current.dayOfWeek === WEDNESDAY) {
    if (current.hour < 9 || (current.hour === 9 && current.minute < 30)) {
      // Before 9:30 AM today - schedule for 9:30 AM today
      daysToAdd = 0;
      targetHour = 9;
      targetMinute = 30;
    } else if (current.hour < 11) {
      // Between 9:30 and 11:00 AM today - schedule for remaining window or current
      daysToAdd = 0;
      targetHour = 10;
      targetMinute = 30;
    } else {
      // Past 11:00 AM window on Wednesday - roll forward to next week's Wednesday
      daysToAdd = 7;
      targetHour = 9;
      targetMinute = 30;
    }
  } else {
    // Other days of the week: (3 - current.dayOfWeek + 7) % 7
    daysToAdd = (WEDNESDAY - current.dayOfWeek + 7) % 7;
    targetHour = 9;
    targetMinute = 30;
  }

  return createZonedDate(
    current.year,
    current.month,
    current.day + daysToAdd,
    targetHour,
    targetMinute,
    0,
    tz
  );
}

/**
 * Calculates the Day 4 follow-up due date based on the initial send date.
 *
 * @param {Date | string} initialSentDate
 * @returns {Date} Due date exactly 4 days after initial send
 */
export function getFollowup1DueDate(initialSentDate) {
  const d = new Date(initialSentDate);
  return new Date(d.getTime() + 4 * 24 * 60 * 60 * 1000);
}

/**
 * Calculates the Day 9 follow-up due date based on the initial send date.
 *
 * @param {Date | string} initialSentDate
 * @returns {Date} Due date exactly 9 days after initial send
 */
export function getFollowup2DueDate(initialSentDate) {
  const d = new Date(initialSentDate);
  return new Date(d.getTime() + 9 * 24 * 60 * 60 * 1000);
}

/**
 * Returns an array of emails currently due to be sent from the campaign dataset.
 *
 * Cadence rules:
 * - INITIAL: status is QUEUED and scheduledSend time has passed.
 * - FOLLOWUP_1: status is INITIAL_SENT, not replied/stopped, and Day 4 due date has passed.
 * - FOLLOWUP_2: status is FOLLOWUP_1_SENT, not replied/stopped, and Day 9 due date has passed.
 * - Stopped/Replied/Completed contacts are omitted.
 *
 * @param {object} campaignData - Campaign dataset or CampaignStore
 * @param {Date | string} [currentTime=new Date()] - Reference evaluation time
 * @returns {Array<{
 *   startup: object,
 *   contact: object,
 *   stage: 'INITIAL' | 'FOLLOWUP_1' | 'FOLLOWUP_2',
 *   scheduledTime: Date,
 *   dueAt: Date,
 *   email: string,
 *   contactId: string,
 *   startupName: string
 * }>}
 */
export function getDueEmails(campaignData, currentTime = new Date()) {
  const startups = campaignData?.startups || campaignData?.data?.startups || [];
  const now = currentTime ? new Date(currentTime) : new Date();
  const nowMs = isNaN(now.getTime()) ? Date.now() : now.getTime();
  const due = [];

  for (const startup of startups) {
    const tz = startup.timezone || 'Asia/Kolkata';

    for (const contact of startup.contacts || []) {
      if (!contact.email) continue;

      const status = (contact.status || 'QUEUED').toUpperCase();

      // Terminal conditions: replied, manually stopped, or finished sequence
      if (
        status === 'REPLIED' ||
        status === 'STOPPED' ||
        contact.stopped === true ||
        Boolean(contact.repliedAt)
      ) {
        continue;
      }

      // Stage 1: Initial Cold Email
      if (status === 'QUEUED') {
        const scheduledTime = contact.scheduledSend
          ? new Date(contact.scheduledSend)
          : getNextWednesdaySendTime(tz);

        if (scheduledTime.getTime() <= nowMs) {
          due.push({
            startup,
            contact,
            stage: 'INITIAL',
            scheduledTime,
            dueAt: scheduledTime,
            email: contact.email,
            contactId: contact.id,
            startupName: startup.name
          });
        }
        continue;
      }

      // Stage 2: Day 4 Follow-up 1
      if (status === 'INITIAL_SENT') {
        if (!contact.initialSentAt) continue;

        const fu1Due = contact.followup1DueDate
          ? new Date(contact.followup1DueDate)
          : getFollowup1DueDate(contact.initialSentAt);

        if (fu1Due.getTime() <= nowMs) {
          due.push({
            startup,
            contact,
            stage: 'FOLLOWUP_1',
            scheduledTime: fu1Due,
            dueAt: fu1Due,
            email: contact.email,
            contactId: contact.id,
            startupName: startup.name
          });
        }
        continue;
      }

      // Stage 3: Day 9 Follow-up 2
      if (status === 'FOLLOWUP_1_SENT' || status === 'FOLLOWUP_1') {
        if (!contact.initialSentAt) continue;

        const fu2Due = contact.followup2DueDate
          ? new Date(contact.followup2DueDate)
          : getFollowup2DueDate(contact.initialSentAt);

        if (fu2Due.getTime() <= nowMs) {
          due.push({
            startup,
            contact,
            stage: 'FOLLOWUP_2',
            scheduledTime: fu2Due,
            dueAt: fu2Due,
            email: contact.email,
            contactId: contact.id,
            startupName: startup.name
          });
        }
        continue;
      }

      // If status is FOLLOWUP_2_SENT or any other completed state, no further sends
    }
  }

  return due;
}
