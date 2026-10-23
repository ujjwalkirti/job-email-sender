// tests/store.test.js
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CampaignStore } from '../src/campaign/store.js';

describe('CampaignStore', () => {
  const testDbPath = path.resolve('data/test_campaign.json');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  afterEach(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  test('initializes with seed data and saves/loads correctly', () => {
    const initialData = {
      updatedAt: new Date().toISOString(),
      startups: [
        {
          id: 'test_1',
          name: 'Test Startup',
          website: 'https://test.example',
          fundingRound: 'Seed',
          roundAmount: '$1.5M',
          fundedDate: '2026-05-01',
          fundedMonthsAgo: 5,
          employeeCount: 15,
          productDescription: 'Distributed AI data pipelines',
          source: 'Entrackr',
          timezone: 'Asia/Kolkata',
          contacts: [
            {
              id: 'c1',
              name: 'Alice Founder',
              role: 'Founder',
              email: 'alice@test.example',
              status: 'QUEUED',
              history: []
            },
            {
              id: 'c2',
              name: 'Bob CTO',
              role: 'TechLead',
              email: 'bob@test.example',
              status: 'QUEUED',
              history: []
            }
          ]
        }
      ]
    };

    const store = new CampaignStore(testDbPath);
    store.saveCampaign(initialData);

    const loaded = store.loadCampaign();
    assert.equal(loaded.startups.length, 1);
    assert.equal(loaded.startups[0].contacts.length, 2);

    const stats = store.getSummaryStats();
    assert.equal(stats.totalStartups, 1);
    assert.equal(stats.totalContacts, 2);
    assert.equal(stats.queued, 2);
  });

  test('updates contact status and records timestamp', () => {
    const initialData = {
      updatedAt: new Date().toISOString(),
      startups: [
        {
          id: 'test_1',
          name: 'Test Startup',
          website: 'https://test.example',
          fundingRound: 'Seed',
          roundAmount: '$1.5M',
          fundedDate: '2026-05-01',
          fundedMonthsAgo: 5,
          employeeCount: 15,
          productDescription: 'Distributed AI data pipelines',
          source: 'Entrackr',
          timezone: 'Asia/Kolkata',
          contacts: [
            {
              id: 'c1',
              name: 'Alice Founder',
              role: 'Founder',
              email: 'alice@test.example',
              status: 'QUEUED',
              history: []
            }
          ]
        }
      ]
    };

    const store = new CampaignStore(testDbPath);
    store.saveCampaign(initialData);

    const updated = store.updateContactStatus('alice@test.example', 'INITIAL_SENT', { sentAt: '2026-10-28T09:30:00+05:30' });
    assert.equal(updated, true);

    const reloaded = store.loadCampaign();
    const contact = reloaded.startups[0].contacts[0];
    assert.equal(contact.status, 'INITIAL_SENT');
    assert.equal(contact.initialSentAt, '2026-10-28T09:30:00+05:30');
  });

  test('getStartup retrieves startup by ID or returns undefined', () => {
    const initialData = {
      updatedAt: new Date().toISOString(),
      startups: [
        {
          id: 'startup_alpha',
          name: 'Alpha AI',
          website: 'https://alpha.ai',
          fundingRound: 'Seed',
          roundAmount: '$2.0M',
          fundedDate: '2026-04-15',
          fundedMonthsAgo: 6,
          employeeCount: 18,
          productDescription: 'Autonomous backend indexing',
          source: 'Entrackr',
          timezone: 'Asia/Kolkata',
          contacts: [
            {
              id: 'c1',
              name: 'John Founder',
              role: 'Founder',
              email: 'john@alpha.ai',
              status: 'QUEUED',
              history: []
            }
          ]
        }
      ]
    };

    const store = new CampaignStore(testDbPath);
    store.saveCampaign(initialData);

    const found = store.getStartup('startup_alpha');
    assert.ok(found);
    assert.equal(found.name, 'Alpha AI');

    const notFound = store.getStartup('non_existent');
    assert.equal(notFound, undefined);
  });

  test('updateContactStatus returns false for non-existent contact', () => {
    const store = new CampaignStore(testDbPath);
    store.saveCampaign({
      updatedAt: new Date().toISOString(),
      startups: []
    });

    const result = store.updateContactStatus('unknown@test.example', 'INITIAL_SENT');
    assert.equal(result, false);
  });

  test('getSummaryStats accurately tallies all contact statuses', () => {
    const initialData = {
      updatedAt: new Date().toISOString(),
      startups: [
        {
          id: 's1',
          name: 'Startup 1',
          contacts: [
            { id: 'c1', email: 'c1@s1.io', status: 'QUEUED' },
            { id: 'c2', email: 'c2@s1.io', status: 'INITIAL_SENT' }
          ]
        },
        {
          id: 's2',
          name: 'Startup 2',
          contacts: [
            { id: 'c3', email: 'c3@s2.io', status: 'FOLLOWUP_1_SENT' },
            { id: 'c4', email: 'c4@s2.io', status: 'FOLLOWUP_2_SENT' }
          ]
        },
        {
          id: 's3',
          name: 'Startup 3',
          contacts: [
            { id: 'c5', email: 'c5@s3.io', status: 'REPLIED' },
            { id: 'c6', email: 'c6@s3.io', status: 'STOPPED' }
          ]
        }
      ]
    };

    const store = new CampaignStore(testDbPath);
    store.saveCampaign(initialData);

    const stats = store.getSummaryStats();
    assert.equal(stats.totalStartups, 3);
    assert.equal(stats.totalContacts, 6);
    assert.equal(stats.queued, 1);
    assert.equal(stats.initialSent, 1);
    assert.equal(stats.followup1, 1);
    assert.equal(stats.followup2, 1);
    assert.equal(stats.replied, 1);
    assert.equal(stats.stopped, 1);
  });

  test('validates seed_startups_initial.json satisfies all dataset constraints', () => {
    const seedPath = path.resolve('data/seed_startups_initial.json');
    assert.ok(fs.existsSync(seedPath), 'seed_startups_initial.json must exist');

    const seedRaw = fs.readFileSync(seedPath, 'utf8');
    const seedData = JSON.parse(seedRaw);

    assert.ok(Array.isArray(seedData.startups), 'startups must be an array');
    assert.equal(seedData.startups.length, 25, 'must contain exactly 25 seed startups');

    let totalContacts = 0;
    const emails = new Set();
    const currentDate = new Date('2026-10-23');

    for (const startup of seedData.startups) {
      assert.ok(startup.id, `Startup ${startup.name} missing id`);
      assert.ok(startup.name, `Startup missing name`);
      assert.ok(startup.website, `Startup ${startup.name} missing website`);
      assert.equal(startup.fundingRound, 'Seed', `Startup ${startup.name} fundingRound must be Seed`);
      assert.ok(startup.roundAmount, `Startup ${startup.name} missing roundAmount`);
      assert.ok(startup.fundedDate, `Startup ${startup.name} missing fundedDate`);
      assert.ok(startup.productDescription, `Startup ${startup.name} missing productDescription`);
      assert.ok(startup.source, `Startup ${startup.name} missing source`);
      assert.ok(startup.timezone, `Startup ${startup.name} missing timezone`);

      // Headcount < 30
      assert.ok(startup.employeeCount > 0 && startup.employeeCount < 30,
        `Startup ${startup.name} employeeCount must be < 30, got ${startup.employeeCount}`);

      // Funded date between 2 and 9 months ago relative to 2026-10-23
      const fundedDate = new Date(startup.fundedDate);
      const diffMonths = (currentDate.getFullYear() - fundedDate.getFullYear()) * 12 +
                         (currentDate.getMonth() - fundedDate.getMonth()) +
                         (currentDate.getDate() - fundedDate.getDate()) / 30;
      assert.ok(diffMonths >= 1.9 && diffMonths <= 9.1,
        `Startup ${startup.name} fundedDate ${startup.fundedDate} is ${diffMonths.toFixed(1)} months ago, must be 2-9 months`);

      // Exactly 2 contacts
      assert.equal(startup.contacts.length, 2, `Startup ${startup.name} must have exactly 2 contacts`);

      const roles = startup.contacts.map(c => c.role);
      assert.ok(roles.includes('Founder'), `Startup ${startup.name} must have a Founder contact`);
      assert.ok(roles.includes('TechLead'), `Startup ${startup.name} must have a TechLead contact`);

      for (const contact of startup.contacts) {
        assert.ok(contact.id, `Contact ${contact.name} missing id`);
        assert.ok(contact.name, `Contact missing name`);
        assert.ok(contact.email && contact.email.includes('@'), `Contact ${contact.name} invalid email: ${contact.email}`);
        assert.equal(contact.status, 'QUEUED', `Contact ${contact.name} initial status must be QUEUED`);
        assert.ok(!emails.has(contact.email), `Duplicate contact email: ${contact.email}`);
        emails.add(contact.email);
        totalContacts++;
      }
    }

    assert.equal(totalContacts, 50, 'must contain exactly 50 contacts (25 * 2)');
  });
});
