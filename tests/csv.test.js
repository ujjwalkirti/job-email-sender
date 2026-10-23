// tests/csv.test.js
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { exportCampaignToCSV, importCampaignFromCSV, parseCSV, escapeCSVField } from '../src/cli/csv_sync.js';
import { generateDraftPreview, formatDraftPreview } from '../src/cli/preview.js';
import { parseArgs } from '../src/cli/index.js';

describe('CSV Sync', () => {
  const testCsv = path.resolve('data/test_sync.csv');

  afterEach(() => {
    if (fs.existsSync(testCsv)) fs.unlinkSync(testCsv);
  });

  test('exports campaign to CSV and imports modifications back', () => {
    const campaign = {
      updatedAt: new Date().toISOString(),
      startups: [
        {
          id: 's1',
          name: 'HyperScale',
          website: 'https://hyperscale.test',
          fundingRound: 'Seed',
          roundAmount: '$2.5M',
          fundedDate: '2026-04-01',
          fundedMonthsAgo: 6,
          employeeCount: 20,
          productDescription: 'Distributed AI agent gateway',
          source: 'Entrackr',
          timezone: 'Asia/Kolkata',
          contacts: [
            { id: 'c1', name: 'Ravi', role: 'Founder', email: 'ravi@hyperscale.test', status: 'QUEUED' },
            { id: 'c2', name: 'Neha', role: 'TechLead', email: 'neha@hyperscale.test', status: 'QUEUED' }
          ]
        }
      ]
    };

    exportCampaignToCSV(campaign, testCsv);
    assert.ok(fs.existsSync(testCsv));

    // Simulate user editing email in CSV
    let csvContent = fs.readFileSync(testCsv, 'utf-8');
    csvContent = csvContent.replace('ravi@hyperscale.test', 'ravi.sharma@hyperscale.test');
    fs.writeFileSync(testCsv, csvContent, 'utf-8');

    const updated = importCampaignFromCSV(testCsv, campaign);
    assert.equal(updated.startups[0].contacts[0].email, 'ravi.sharma@hyperscale.test');
  });

  test('properly escapes quotes, commas, and special characters in CSV', () => {
    const campaign = {
      updatedAt: new Date().toISOString(),
      startups: [
        {
          id: 's2',
          name: 'Alpha, Beta & "Gamma" Technologies',
          website: 'https://alphabetagamma.test',
          fundingRound: 'Seed',
          roundAmount: '$1.8M',
          fundedDate: '2026-05-10',
          fundedMonthsAgo: 5,
          employeeCount: 15,
          productDescription: 'Next-gen, real-time "AI" data pipelines\nwith zero latency',
          source: 'Inc42',
          timezone: 'Asia/Kolkata',
          contacts: [
            {
              id: 'c3',
              name: 'Dr. Jane "JC" Connor, Ph.D.',
              role: 'Founder & CEO',
              email: 'jane@alphabetagamma.test',
              status: 'QUEUED',
              notes: 'Met at conference, very interested'
            }
          ]
        }
      ]
    };

    exportCampaignToCSV(campaign, testCsv);
    assert.ok(fs.existsSync(testCsv));

    const imported = importCampaignFromCSV(testCsv, campaign);
    assert.equal(imported.startups[0].name, 'Alpha, Beta & "Gamma" Technologies');
    assert.equal(imported.startups[0].contacts[0].name, 'Dr. Jane "JC" Connor, Ph.D.');
    assert.equal(imported.startups[0].contacts[0].role, 'Founder & CEO');
    assert.equal(imported.startups[0].contacts[0].notes, 'Met at conference, very interested');
  });

  test('updates status and metadata modifications from CSV', () => {
    const campaign = {
      updatedAt: new Date().toISOString(),
      startups: [
        {
          id: 's3',
          name: 'CloudSync',
          website: 'https://cloudsync.test',
          fundingRound: 'Seed',
          roundAmount: '$2.0M',
          fundedDate: '2026-03-15',
          fundedMonthsAgo: 7,
          employeeCount: 22,
          productDescription: 'Distributed sync engine',
          source: 'Wellfound',
          timezone: 'Asia/Kolkata',
          contacts: [
            { id: 'c4', name: 'Alex', role: 'Founder', email: 'alex@cloudsync.test', status: 'QUEUED' }
          ]
        }
      ]
    };

    exportCampaignToCSV(campaign, testCsv);
    let csvContent = fs.readFileSync(testCsv, 'utf-8');
    csvContent = csvContent.replace('QUEUED', 'REPLIED');
    fs.writeFileSync(testCsv, csvContent, 'utf-8');

    const updated = importCampaignFromCSV(testCsv, campaign);
    assert.equal(updated.startups[0].contacts[0].status, 'REPLIED');
  });

  test('escapes and parses CSV fields correctly with low-level helpers', () => {
    assert.equal(escapeCSVField(null), '');
    assert.equal(escapeCSVField(undefined), '');
    assert.equal(escapeCSVField('Simple text'), 'Simple text');
    assert.equal(escapeCSVField('Text, with comma'), '"Text, with comma"');
    assert.equal(escapeCSVField('Text with "quotes"'), '"Text with ""quotes"""');
    assert.equal(escapeCSVField('Line 1\nLine 2'), '"Line 1\nLine 2"');

    const raw = 'col1,col2,"col, 3","col ""with"" quotes","line\nbreak"\r\nval1,val2,val3,val4,val5\r\n';
    const parsed = parseCSV(raw);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0][0], 'col1');
    assert.equal(parsed[0][2], 'col, 3');
    assert.equal(parsed[0][3], 'col "with" quotes');
    assert.equal(parsed[0][4], 'line\nbreak');
    assert.equal(parsed[1][0], 'val1');
  });

  test('throws when importing from non-existent CSV file', () => {
    assert.throws(() => {
      importCampaignFromCSV('data/non_existent.csv', {});
    }, /CSV file not found/);
  });
});

describe('Preview & CLI Utilities', () => {
  const startup = {
    name: 'NeuralScale',
    roundAmount: '$2.2M',
    fundingRound: 'Seed',
    productDescription: 'Autonomous backend orchestration engine',
    timezone: 'Asia/Kolkata'
  };

  const contact = {
    name: 'Siddharth Roy',
    role: 'TechLead',
    email: 'siddharth@neuralscale.test'
  };

  const sender = {
    senderName: 'Ujjwal Kirti',
    portfolioUrl: 'https://ujjwal-portfolio-flame.vercel.app/',
    githubUrl: 'https://github.com/ujjwalkirti'
  };

  test('generates compliant draft preview with accurate metrics', () => {
    const preview = generateDraftPreview(startup, contact, sender);

    assert.equal(preview.overallValid, true);
    assert.ok(preview.metrics.subjectLength >= 36 && preview.metrics.subjectLength <= 50);
    assert.equal(preview.metrics.subjectValid, true);
    assert.ok(preview.metrics.wordCount >= 90 && preview.metrics.wordCount <= 120);
    assert.equal(preview.metrics.wordCountValid, true);
    assert.equal(preview.metrics.hookValid, true);
    assert.equal(preview.metrics.closingValid, true);
  });

  test('formats preview card with pass badges and plain text support', () => {
    const plainCard = formatDraftPreview(startup, contact, sender, { plain: true });

    assert.ok(plainCard.includes('STARTUP: NeuralScale'));
    assert.ok(plainCard.includes('CONTACT: Siddharth Roy'));
    assert.ok(plainCard.includes('[PASS:'));
    assert.ok(plainCard.includes('What are you struggling to hire for right now?'));
    assert.ok(!plainCard.includes('\x1b[')); // no ANSI escapes in plain mode
  });

  test('parseArgs accurately extracts commands, flags, and positionals', () => {
    const args = ['send', '--dry-run', '--limit=5', '--email=test@example.com', 'extraPositional'];
    const parsed = parseArgs(args);

    assert.equal(parsed.command, 'send');
    assert.equal(parsed.flags['dry-run'], true);
    assert.equal(parsed.flags.limit, '5');
    assert.equal(parsed.flags.email, 'test@example.com');
    assert.deepEqual(parsed.positional, ['extraPositional']);
  });
});
