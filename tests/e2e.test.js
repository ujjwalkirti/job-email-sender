// tests/e2e.test.js
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CampaignStore } from '../src/campaign/store.js';
import { generateInitialEmail } from '../src/generator/templates.js';
import { validateEmail } from '../src/generator/validator.js';
import { isEligibleSeedStartup } from '../src/discovery/filter.js';
import { Mailer } from '../src/dispatcher/mailer.js';
import { recordSendSuccess, markContactReplied } from '../src/dispatcher/tracker.js';
import { exportCampaignToCSV, importCampaignFromCSV } from '../src/cli/csv_sync.js';

describe('End-to-End Campaign Dataset Verification', () => {
  const seedPath = path.resolve('data/seed_startups_initial.json');
  const campaignPath = path.resolve('data/campaign.json');
  const csvPath = path.resolve('data/startups.csv');
  const senderPath = path.resolve('config/sender.json');
  const tempCampaignPath = path.resolve('data/test_e2e_temp_campaign.json');
  const tempCsvPath = path.resolve('data/test_e2e_temp.csv');

  afterEach(() => {
    if (fs.existsSync(tempCampaignPath)) fs.unlinkSync(tempCampaignPath);
    if (fs.existsSync(tempCsvPath)) fs.unlinkSync(tempCsvPath);
  });

  test('active dataset has exactly 25 startups and 50 contacts matching all criteria', () => {
    assert.ok(fs.existsSync(seedPath), 'Seed dataset must exist');
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    const sender = JSON.parse(fs.readFileSync(senderPath, 'utf-8'));

    assert.equal(seedData.startups.length, 25, 'Must contain exactly 25 startups');

    let totalContacts = 0;
    const errors = [];

    for (const startup of seedData.startups) {
      // 1. Check eligibility: 2-9 months, <30 employees
      const eligibility = isEligibleSeedStartup(startup, new Date('2026-10-23T00:00:00Z'));
      assert.equal(eligibility.eligible, true, `${startup.name} failed eligibility: ${eligibility.reasons.join(', ')}`);

      // 2. Check contacts count
      assert.equal(startup.contacts.length, 2, `${startup.name} must have exactly 2 contacts`);
      totalContacts += startup.contacts.length;

      // 3. Verify generated emails meet strict constraints
      for (const contact of startup.contacts) {
        const email = generateInitialEmail(startup, contact, sender);
        const val = validateEmail({
          subject: email.subject,
          bodyText: email.bodyText,
          startupName: startup.name,
          productOrRaise: startup.roundAmount
        });

        if (!val.valid) {
          errors.push(`${startup.name} -> ${contact.name} (${contact.role}): ${val.errors.join(' | ')}`);
        }
      }
    }

    assert.equal(totalContacts, 50, 'Total contacts must be exactly 50');
    assert.equal(errors.length, 0, `Validation errors found in initial templates:\n${errors.join('\n')}`);
  });

  test('all 50 initial email drafts strictly pass word count, subject length, hook, and closing question', () => {
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    const sender = JSON.parse(fs.readFileSync(senderPath, 'utf-8'));

    let checkedCount = 0;

    for (const startup of seedData.startups) {
      const roles = startup.contacts.map((c) => c.role);
      assert.ok(roles.includes('Founder'), `${startup.name} must have a Founder contact`);
      assert.ok(roles.includes('TechLead'), `${startup.name} must have a TechLead contact`);

      for (const contact of startup.contacts) {
        const email = generateInitialEmail(startup, contact, sender);
        checkedCount++;

        // Word count strictly between 90 and 120
        const wordCount = email.bodyText.trim().split(/\s+/).filter(Boolean).length;
        assert.ok(
          wordCount >= 90 && wordCount <= 120,
          `Word count (${wordCount}) out of range [90, 120] for ${startup.name} / ${contact.name}`
        );

        // Subject length strictly between 36 and 50 characters
        assert.ok(
          email.subject.length >= 36 && email.subject.length <= 50,
          `Subject length (${email.subject.length}) out of range [36, 50] for ${startup.name}: "${email.subject}"`
        );

        // Exact closing question
        assert.ok(
          email.bodyText.includes('What are you struggling to hire for right now?'),
          `Missing closing question for ${startup.name} / ${contact.name}`
        );

        // Line 1 hook mentions company name or round
        const lines = email.bodyText.split('\n').map((l) => l.trim()).filter(Boolean);
        const line1Hook = lines[1]; // line 0 is salutation "Hi Name,"
        assert.ok(
          line1Hook.includes(startup.name) || line1Hook.includes(startup.roundAmount),
          `Line 1 hook does not reference company or raise for ${startup.name}: "${line1Hook}"`
        );

        // No attachments or resume mentions
        assert.ok(!email.bodyText.toLowerCase().includes('resume'), `Found resume mention in ${startup.name}`);
        assert.ok(!email.bodyText.toLowerCase().includes('attached'), `Found attachment mention in ${startup.name}`);
      }
    }

    assert.equal(checkedCount, 50, 'Must have evaluated exactly 50 contact drafts');
  });

  test('data/campaign.json and data/startups.csv are properly initialized and synchronized', () => {
    assert.ok(fs.existsSync(campaignPath), 'data/campaign.json must exist');
    assert.ok(fs.existsSync(csvPath), 'data/startups.csv must exist');

    const campaignData = JSON.parse(fs.readFileSync(campaignPath, 'utf-8'));
    assert.equal(campaignData.startups.length, 25, 'campaign.json must contain 25 startups');

    const totalContacts = campaignData.startups.reduce((acc, st) => acc + (st.contacts ? st.contacts.length : 0), 0);
    assert.equal(totalContacts, 50, 'campaign.json must contain 50 contacts');

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const csvRows = csvContent.trim().split('\n');
    assert.equal(csvRows.length, 51, 'startups.csv must have 51 rows (1 header + 50 contacts)');

    // Roundtrip verification: exporting campaign produces equivalent CSV data
    exportCampaignToCSV(campaignData, tempCsvPath);
    assert.ok(fs.existsSync(tempCsvPath), 'Exported temp CSV must exist');
    const tempRows = fs.readFileSync(tempCsvPath, 'utf-8').trim().split('\n');
    assert.equal(tempRows.length, 51);

    const reimported = importCampaignFromCSV(tempCsvPath, campaignData);
    assert.equal(reimported.startups.length, 25);
    const reimportedContacts = reimported.startups.reduce((acc, st) => acc + (st.contacts ? st.contacts.length : 0), 0);
    assert.equal(reimportedContacts, 50);
  });

  test('dry-run dispatch simulation verifies status transition to INITIAL_SENT and Day 4 follow-up scheduling', async () => {
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    fs.writeFileSync(tempCampaignPath, JSON.stringify(seedData, null, 2), 'utf-8');

    const store = new CampaignStore(tempCampaignPath);
    store.loadCampaign();

    const targetStartup = store.data.startups[0];
    const targetContact = targetStartup.contacts[0];
    assert.equal(targetContact.status, 'QUEUED');

    // Setup dry-run mailer
    const mailer = new Mailer({ dryRun: true });
    const sender = JSON.parse(fs.readFileSync(senderPath, 'utf-8'));
    const emailDraft = generateInitialEmail(targetStartup, targetContact, sender);

    // Validate email before send
    const val = validateEmail({
      subject: emailDraft.subject,
      bodyText: emailDraft.bodyText,
      startupName: targetStartup.name,
      productOrRaise: targetStartup.roundAmount
    });
    assert.ok(val.valid, 'Draft must be valid');

    // Perform dry-run dispatch
    const sendResult = await mailer.sendEmail({
      to: targetContact.email,
      subject: emailDraft.subject,
      text: emailDraft.bodyText,
      html: emailDraft.html
    });

    assert.equal(sendResult.dryRun, true);
    assert.ok(sendResult.messageId);

    // Record send success at fixed timestamp: 2026-10-23T04:00:00.000Z
    const fixedSendTime = new Date('2026-10-23T04:00:00.000Z');
    const recordResult = recordSendSuccess(store, targetContact.email, 'INITIAL', fixedSendTime);
    assert.equal(recordResult.success, true);

    // Reload from disk to verify persistence
    const reloadedStore = new CampaignStore(tempCampaignPath);
    reloadedStore.loadCampaign();
    const updatedStartup = reloadedStore.getStartup(targetStartup.id);
    const updatedContact = updatedStartup.contacts.find((c) => c.email === targetContact.email);

    // Assert status transition
    assert.equal(updatedContact.status, 'INITIAL_SENT');
    assert.equal(updatedContact.initialSentAt, '2026-10-23T04:00:00.000Z');

    // Assert Day 4 follow-up scheduled (+4 days = 2026-10-27)
    assert.ok(updatedContact.followup1DueDate, 'followup1DueDate must be set');
    const fu1Date = new Date(updatedContact.followup1DueDate);
    const dayDiff = Math.round((fu1Date.getTime() - fixedSendTime.getTime()) / (1000 * 60 * 60 * 24));
    assert.equal(dayDiff, 4, 'Follow-up 1 must be scheduled exactly 4 days after initial send');
    assert.equal(fu1Date.toISOString(), '2026-10-27T04:00:00.000Z');

    // Assert history log entry
    assert.ok(Array.isArray(updatedContact.history));
    assert.equal(updatedContact.history.length, 1);
    assert.equal(updatedContact.history[0].status, 'INITIAL_SENT');

    // Simulate reply received
    const replyResult = markContactReplied(reloadedStore, targetContact.email, 'Interested in speaking');
    assert.equal(replyResult.success, true);

    const repliedStartup = reloadedStore.getStartup(targetStartup.id);
    const repliedContact = repliedStartup.contacts.find((c) => c.email === targetContact.email);
    assert.equal(repliedContact.status, 'REPLIED');
    assert.equal(repliedContact.stopped, true);
    assert.equal(repliedContact.notes, 'Interested in speaking');
  });
});
