import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  getNextWednesdaySendTime,
  getFollowup1DueDate,
  getFollowup2DueDate,
  getDueEmails
} from '../src/dispatcher/scheduler.js';
import { Mailer } from '../src/dispatcher/mailer.js';
import { recordSendSuccess, markContactReplied } from '../src/dispatcher/tracker.js';
import { CampaignStore } from '../src/campaign/store.js';

describe('Timezone Scheduler & Due Calculator', () => {
  test('calculates next Wednesday between 9:00 and 11:00 AM in target timezone', () => {
    // A Monday (e.g. 2026-10-26)
    const monday = new Date('2026-10-26T03:30:00.000Z'); // 9:00 AM IST
    const nextWed = getNextWednesdaySendTime('Asia/Kolkata', monday);

    // Wednesday should be 2026-10-28
    assert.equal(nextWed.getUTCFullYear(), 2026);
    assert.equal(nextWed.getUTCMonth(), 9); // October (0-indexed)
    assert.equal(nextWed.getUTCDate(), 28);
    // In IST (UTC+5:30), 9:30 AM is 04:00 UTC
    assert.ok(nextWed.getUTCHours() >= 3 && nextWed.getUTCHours() <= 6);
  });

  test('calculates next Wednesday across US timezones correctly', () => {
    // Thursday in New York
    const thursdayNy = new Date('2026-10-22T14:00:00.000Z'); // 10:00 AM EDT
    const nextWedNy = getNextWednesdaySendTime('America/New_York', thursdayNy);

    // Should be Wednesday 2026-10-28
    assert.equal(nextWedNy.getUTCFullYear(), 2026);
    assert.equal(nextWedNy.getUTCMonth(), 9);
    assert.equal(nextWedNy.getUTCDate(), 28);
    // In EDT (UTC-4), 9:30 AM EDT is 13:30 UTC
    assert.ok(nextWedNy.getUTCHours() >= 13 && nextWedNy.getUTCHours() <= 15);
  });

  test('rolls to next week if current time on Wednesday is past 11:00 AM window', () => {
    // Wednesday 2026-10-28 at 14:00 IST (UTC 08:30)
    const wednesdayAfternoon = new Date('2026-10-28T08:30:00.000Z');
    const nextWed = getNextWednesdaySendTime('Asia/Kolkata', wednesdayAfternoon);

    // Should roll forward 7 days to 2026-11-04
    assert.equal(nextWed.getUTCFullYear(), 2026);
    assert.equal(nextWed.getUTCMonth(), 10); // November
    assert.equal(nextWed.getUTCDate(), 4);
  });

  test('schedules for today if current time on Wednesday is before 9:30 AM', () => {
    // Wednesday 2026-10-28 at 08:00 IST (UTC 02:30)
    const wednesdayEarly = new Date('2026-10-28T02:30:00.000Z');
    const todayWed = getNextWednesdaySendTime('Asia/Kolkata', wednesdayEarly);

    assert.equal(todayWed.getUTCFullYear(), 2026);
    assert.equal(todayWed.getUTCMonth(), 9); // October
    assert.equal(todayWed.getUTCDate(), 28);
  });

  test('uses default timezone Asia/Kolkata when none is provided', () => {
    const monday = new Date('2026-10-26T03:30:00.000Z');
    const wedDefault = getNextWednesdaySendTime(undefined, monday);
    assert.equal(wedDefault.getUTCDate(), 28);
    assert.ok(wedDefault.getUTCHours() >= 3 && wedDefault.getUTCHours() <= 6);
  });

  test('calculates Day 4 and Day 9 follow-up due dates accurately', () => {
    const initialSend = new Date('2026-10-28T04:00:00.000Z'); // Wed Oct 28
    const fu1 = getFollowup1DueDate(initialSend);
    const fu2 = getFollowup2DueDate(initialSend);

    const diffDays1 = Math.round((fu1.getTime() - initialSend.getTime()) / (1000 * 60 * 60 * 24));
    const diffDays2 = Math.round((fu2.getTime() - initialSend.getTime()) / (1000 * 60 * 60 * 24));

    assert.equal(diffDays1, 4);
    assert.equal(diffDays2, 9);
  });

  test('detects due initial sends when scheduled time has passed and status is QUEUED', () => {
    const campaign = {
      startups: [
        {
          name: 'Acme',
          timezone: 'Asia/Kolkata',
          contacts: [
            {
              id: 'c1',
              email: 'test@example.com',
              status: 'QUEUED',
              scheduledSend: '2026-10-28T04:00:00.000Z'
            }
          ]
        }
      ]
    };

    const before = new Date('2026-10-28T03:00:00.000Z');
    const after = new Date('2026-10-28T04:30:00.000Z');

    assert.equal(getDueEmails(campaign, before).length, 0);
    assert.equal(getDueEmails(campaign, after).length, 1);
  });

  test('detects due Follow-up 1 on Day 4 and Follow-up 2 on Day 9 if no reply', () => {
    const initialSendDate = '2026-10-28T04:00:00.000Z';
    const fu1SentDate = '2026-11-01T04:00:00.000Z'; // Day 4

    const campaign = {
      startups: [
        {
          name: 'Acme',
          timezone: 'Asia/Kolkata',
          contacts: [
            {
              id: 'c1',
              email: 'c1@example.com',
              status: 'INITIAL_SENT',
              initialSentAt: initialSendDate
            },
            {
              id: 'c2',
              email: 'c2@example.com',
              status: 'FOLLOWUP_1_SENT',
              initialSentAt: initialSendDate,
              followup1SentAt: fu1SentDate
            }
          ]
        }
      ]
    };

    // Day 3 after initial send: neither follow-up 1 nor 2 is due
    const day3 = new Date('2026-10-31T04:00:00.000Z');
    assert.equal(getDueEmails(campaign, day3).length, 0);

    // Day 4 after initial send: Follow-up 1 is due
    const day4 = new Date('2026-11-01T04:30:00.000Z');
    const dueDay4 = getDueEmails(campaign, day4);
    assert.equal(dueDay4.length, 1);
    assert.equal(dueDay4[0].contactId, 'c1');
    assert.equal(dueDay4[0].stage, 'FOLLOWUP_1');

    // Day 9 after initial send: Follow-up 2 is due
    const day9 = new Date('2026-11-06T04:30:00.000Z');
    const dueDay9 = getDueEmails(campaign, day9);
    assert.equal(dueDay9.length, 2); // c1 is still due for FU1 because not updated, and c2 is due for FU2
    const fu2Due = dueDay9.find((d) => d.stage === 'FOLLOWUP_2');
    assert.ok(fu2Due);
    assert.equal(fu2Due.contactId, 'c2');
  });

  test('never returns emails for contacts marked REPLIED or STOPPED', () => {
    const campaign = {
      startups: [
        {
          name: 'Acme',
          timezone: 'Asia/Kolkata',
          contacts: [
            {
              id: 'c1',
              email: 'replied@example.com',
              status: 'REPLIED',
              initialSentAt: '2026-10-28T04:00:00.000Z',
              repliedAt: '2026-10-29T10:00:00.000Z'
            },
            {
              id: 'c2',
              email: 'stopped@example.com',
              status: 'STOPPED',
              initialSentAt: '2026-10-28T04:00:00.000Z'
            },
            {
              id: 'c3',
              email: 'fu2done@example.com',
              status: 'FOLLOWUP_2_SENT',
              initialSentAt: '2026-10-28T04:00:00.000Z',
              followup2SentAt: '2026-11-06T04:00:00.000Z'
            }
          ]
        }
      ]
    };

    const future = new Date('2026-11-15T00:00:00.000Z');
    assert.equal(getDueEmails(campaign, future).length, 0);
  });
});

describe('Mailer Transport Wrapper', () => {
  test('operates in dryRun mode without sending actual network requests', async () => {
    const mailer = new Mailer({ dryRun: true, minDelayMs: 0, maxDelayMs: 0 });
    const result = await mailer.sendEmail({
      to: 'recipient@startup.test',
      subject: 'Backend architecture for Acme',
      html: '<p>Hello world</p>',
      text: 'Hello world'
    });

    assert.equal(result.success, true);
    assert.equal(result.dryRun, true);
    assert.ok(result.messageId.startsWith('dryrun-'));
    assert.equal(mailer.sentLog.length, 1);
    assert.equal(mailer.sentLog[0].to, 'recipient@startup.test');
  });

  test('applies rate-limiting delay between email dispatches', async () => {
    const mailer = new Mailer({ dryRun: true, minDelayMs: 15, maxDelayMs: 30 });
    const t0 = Date.now();
    await mailer.sendEmail({
      to: 'batch1@startup.test',
      subject: 'Subject 1',
      text: 'Body 1'
    });
    await mailer.sendEmail({
      to: 'batch2@startup.test',
      subject: 'Subject 2',
      text: 'Body 2'
    });
    const elapsed = Date.now() - t0;
    assert.ok(elapsed >= 15, `Elapsed time should reflect jitter delay (actual: ${elapsed}ms)`);
  });

  test('validates required recipient and subject fields', async () => {
    const mailer = new Mailer({ dryRun: true, minDelayMs: 0, maxDelayMs: 0 });
    await assert.rejects(
      async () => mailer.sendEmail({ subject: 'Missing recipient' }),
      /Email recipient \(to\) and subject are required/
    );
    await assert.rejects(
      async () => mailer.sendEmail({ to: 'to@test.com' }),
      /Email recipient \(to\) and subject are required/
    );
  });

  test('sends batch emails with sendBatch', async () => {
    const mailer = new Mailer({ dryRun: true, minDelayMs: 0, maxDelayMs: 0 });
    const batch = [
      { to: 'a@test.com', subject: 'Subject A', text: 'Text A' },
      { to: 'b@test.com', subject: 'Subject B', text: 'Text B' }
    ];
    const results = await mailer.sendBatch(batch);
    assert.equal(results.length, 2);
    assert.equal(mailer.sentLog.length, 2);
    assert.equal(results[0].to, 'a@test.com');
    assert.equal(results[1].to, 'b@test.com');
  });
});

describe('Contact Outreach Tracker', () => {
  const tmpStorePath = path.resolve('data/test_tracker_store.json');

  afterEach(() => {
    if (fs.existsSync(tmpStorePath)) {
      fs.unlinkSync(tmpStorePath);
    }
  });

  test('recordSendSuccess updates contact status, timestamps, and calculates next due dates (in-memory mock)', () => {
    const mockStore = {
      startups: [
        {
          name: 'BetaCorp',
          contacts: [
            {
              id: 'c10',
              email: 'founder@betacorp.test',
              status: 'QUEUED',
              history: []
            }
          ]
        }
      ]
    };

    const initialSentAt = '2026-10-28T04:00:00.000Z';
    recordSendSuccess(mockStore, 'founder@betacorp.test', 'INITIAL', initialSentAt);

    const contact = mockStore.startups[0].contacts[0];
    assert.equal(contact.status, 'INITIAL_SENT');
    assert.equal(contact.initialSentAt, initialSentAt);
    assert.ok(contact.followup1DueDate);

    // Follow-up 1 send
    const fu1SentAt = '2026-11-01T04:00:00.000Z';
    recordSendSuccess(mockStore, 'founder@betacorp.test', 'FOLLOWUP_1', fu1SentAt);
    assert.equal(contact.status, 'FOLLOWUP_1_SENT');
    assert.equal(contact.followup1SentAt, fu1SentAt);
    assert.ok(contact.followup2DueDate);

    // Follow-up 2 send
    const fu2SentAt = '2026-11-06T04:00:00.000Z';
    recordSendSuccess(mockStore, 'founder@betacorp.test', 'FOLLOWUP_2', fu2SentAt);
    assert.equal(contact.status, 'FOLLOWUP_2_SENT');
    assert.equal(contact.followup2SentAt, fu2SentAt);
    assert.equal(contact.stopped, true);
  });

  test('markContactReplied transitions contact to REPLIED and stores notes (in-memory mock)', () => {
    const mockStore = {
      startups: [
        {
          name: 'BetaCorp',
          contacts: [
            {
              id: 'c10',
              email: 'founder@betacorp.test',
              status: 'INITIAL_SENT',
              initialSentAt: '2026-10-28T04:00:00.000Z',
              history: []
            }
          ]
        }
      ]
    };

    markContactReplied(mockStore, 'founder@betacorp.test', 'Interested in exploring hiring');
    const contact = mockStore.startups[0].contacts[0];
    assert.equal(contact.status, 'REPLIED');
    assert.equal(contact.notes, 'Interested in exploring hiring');
    assert.ok(contact.repliedAt);
  });

  test('integrates seamlessly with CampaignStore instance and file persistence', () => {
    const store = new CampaignStore(tmpStorePath);
    store.saveCampaign({
      updatedAt: new Date().toISOString(),
      startups: [
        {
          id: 's_test',
          name: 'StoreStartup',
          contacts: [
            {
              id: 'c_store',
              name: 'John',
              email: 'john@storestartup.test',
              status: 'QUEUED',
              history: []
            }
          ]
        }
      ]
    });

    const initialSentAt = '2026-10-28T04:00:00.000Z';
    recordSendSuccess(store, 'john@storestartup.test', 'INITIAL', initialSentAt);

    // Verify disk persisted change
    const reloaded = new CampaignStore(tmpStorePath);
    reloaded.loadCampaign();
    const contact = reloaded.getStartup('s_test').contacts[0];

    assert.equal(contact.status, 'INITIAL_SENT');
    assert.equal(contact.initialSentAt, initialSentAt);
    assert.ok(contact.followup1DueDate);

    // Mark replied
    markContactReplied(store, 'john@storestartup.test', 'Let us chat tomorrow');
    const reloadedAfterReply = new CampaignStore(tmpStorePath);
    reloadedAfterReply.loadCampaign();
    const contactAfterReply = reloadedAfterReply.getStartup('s_test').contacts[0];

    assert.equal(contactAfterReply.status, 'REPLIED');
    assert.equal(contactAfterReply.notes, 'Let us chat tomorrow');
  });

  test('returns false / error when contact email is not found', () => {
    const mockStore = { startups: [] };
    const res1 = recordSendSuccess(mockStore, 'missing@example.com', 'INITIAL');
    assert.equal(res1.success, false);

    const res2 = markContactReplied(mockStore, 'missing@example.com', 'notes');
    assert.equal(res2.success, false);
  });
});
