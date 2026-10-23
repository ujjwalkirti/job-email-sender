import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isEligibleSeedStartup, calculateFundedMonths } from '../src/discovery/filter.js';
import { parseEntrackrItem, parseInc42Item, parseWellfoundItem } from '../src/discovery/parsers.js';

describe('Discovery Filter Engine', () => {
  const asOf = new Date('2026-10-23T00:00:00Z');

  test('rejects startups funded under 2 months ago (still scrambling)', () => {
    const startup = {
      name: 'Too Recent Startup',
      fundingRound: 'Seed',
      fundedDate: '2026-09-15', // ~1.2 months ago
      employeeCount: 12
    };
    const res = isEligibleSeedStartup(startup, asOf);
    assert.equal(res.eligible, false);
    assert.ok(res.reasons.some(r => r.includes('under 2 months')));
  });

  test('rejects startups funded over 9 months ago (capital allocated)', () => {
    const startup = {
      name: 'Too Old Startup',
      fundingRound: 'Seed',
      fundedDate: '2025-12-01', // ~10.7 months ago
      employeeCount: 15
    };
    const res = isEligibleSeedStartup(startup, asOf);
    assert.equal(res.eligible, false);
    assert.ok(res.reasons.some(r => r.includes('over 9 months')));
  });

  test('rejects startups with 30 or more employees (gatekeepers)', () => {
    const startup = {
      name: 'Big Startup',
      fundingRound: 'Seed',
      fundedDate: '2026-05-15', // ~5.2 months ago
      employeeCount: 35
    };
    const res = isEligibleSeedStartup(startup, asOf);
    assert.equal(res.eligible, false);
    assert.ok(res.reasons.some(r => r.includes('30 people')));
  });

  test('accepts startups funded 2 to 9 months ago with under 30 employees', () => {
    const startup = {
      name: 'Prime Target AI',
      fundingRound: 'Seed',
      fundedDate: '2026-04-10', // ~6.4 months ago
      employeeCount: 18
    };
    const res = isEligibleSeedStartup(startup, asOf);
    assert.equal(res.eligible, true);
    assert.equal(res.reasons.length, 0);
  });

  test('calculateFundedMonths returns accurate month diff using 30.44 days per month', () => {
    // 38 days = ~1.2 months
    const m1 = calculateFundedMonths('2026-09-15', asOf);
    assert.equal(m1, 1.2);

    // 196 days = ~6.4 months
    const m2 = calculateFundedMonths('2026-04-10', asOf);
    assert.equal(m2, 6.4);

    // 326 days = ~10.7 months
    const m3 = calculateFundedMonths('2025-12-01', asOf);
    assert.equal(m3, 10.7);
  });

  test('validates boundary conditions for headcount (29 passes, 30 fails)', () => {
    const startup29 = {
      name: 'Boundary 29',
      fundingRound: 'Seed',
      fundedDate: '2026-04-10',
      employeeCount: 29
    };
    const res29 = isEligibleSeedStartup(startup29, asOf);
    assert.equal(res29.eligible, true);

    const startup30 = {
      name: 'Boundary 30',
      fundingRound: 'Seed',
      fundedDate: '2026-04-10',
      employeeCount: 30
    };
    const res30 = isEligibleSeedStartup(startup30, asOf);
    assert.equal(res30.eligible, false);
    assert.ok(res30.reasons.some(r => r.includes('30 people')));
  });

  test('rejects non-seed funding rounds', () => {
    const startupSeriesA = {
      name: 'Series A Corp',
      fundingRound: 'Series A',
      fundedDate: '2026-04-10',
      employeeCount: 20
    };
    const res = isEligibleSeedStartup(startupSeriesA, asOf);
    assert.equal(res.eligible, false);
    assert.ok(res.reasons.some(r => r.includes('Seed')));
  });

  test('accumulates multiple rejection reasons', () => {
    const badStartup = {
      name: 'Too Recent and Too Big',
      fundingRound: 'Series B',
      fundedDate: '2026-10-01', // under 2 months
      employeeCount: 45 // >= 30
    };
    const res = isEligibleSeedStartup(badStartup, asOf);
    assert.equal(res.eligible, false);
    assert.ok(res.reasons.length >= 3);
    assert.ok(res.reasons.some(r => r.includes('under 2 months')));
    assert.ok(res.reasons.some(r => r.includes('30 people')));
    assert.ok(res.reasons.some(r => r.includes('Seed')));
  });

  test('validates all 25 curated startups from seed_startups_initial.json are eligible', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const data = JSON.parse(fs.readFileSync(path.resolve('data/seed_startups_initial.json'), 'utf8'));
    assert.equal(data.startups.length, 25);
    for (const startup of data.startups) {
      const res = isEligibleSeedStartup(startup, asOf);
      assert.equal(res.eligible, true, `${startup.name} should be eligible: ${res.reasons.join(', ')}`);
    }
  });
});

describe('Discovery Parsers', () => {
  const asOf = new Date('2026-10-23T00:00:00Z');

  test('parseEntrackrItem normalizes raw Entrackr funding tracker item', () => {
    const raw = {
      company: 'Karya AI',
      website: 'https://karya.in',
      round: 'Seed',
      amount: '$2.5M',
      date: '2026-05-12',
      employees: 18,
      sector: 'Decentralized AI data collection and ethical workforce platform',
      timezone: 'Asia/Kolkata'
    };

    const parsed = parseEntrackrItem(raw, asOf);
    assert.equal(parsed.id, 'startup_karya_ai');
    assert.equal(parsed.name, 'Karya AI');
    assert.equal(parsed.website, 'https://karya.in');
    assert.equal(parsed.fundingRound, 'Seed');
    assert.equal(parsed.roundAmount, '$2.5M');
    assert.equal(parsed.fundedDate, '2026-05-12');
    assert.equal(parsed.fundedMonthsAgo, 5.4);
    assert.equal(parsed.employeeCount, 18);
    assert.equal(parsed.productDescription, 'Decentralized AI data collection and ethical workforce platform');
    assert.equal(parsed.source, 'Entrackr');
    assert.equal(parsed.timezone, 'Asia/Kolkata');
    assert.deepEqual(parsed.contacts, []);
  });

  test('parseInc42Item normalizes raw Inc42 funding deal item', () => {
    const raw = {
      startupName: 'Sarvam AI',
      domain: 'https://sarvam.ai',
      stage: 'Seed Round',
      fundingAmount: '$3.0M',
      dealDate: '2026-04-18',
      teamSize: '24',
      overview: 'Full-stack generative AI foundation models optimized for Indian languages'
    };

    const parsed = parseInc42Item(raw, asOf);
    assert.equal(parsed.id, 'startup_sarvam_ai');
    assert.equal(parsed.name, 'Sarvam AI');
    assert.equal(parsed.website, 'https://sarvam.ai');
    assert.equal(parsed.fundingRound, 'Seed');
    assert.equal(parsed.roundAmount, '$3.0M');
    assert.equal(parsed.fundedDate, '2026-04-18');
    assert.equal(parsed.fundedMonthsAgo, 6.2);
    assert.equal(parsed.employeeCount, 24);
    assert.equal(parsed.productDescription, 'Full-stack generative AI foundation models optimized for Indian languages');
    assert.equal(parsed.source, 'Inc42');
    assert.equal(parsed.timezone, 'Asia/Kolkata');
    assert.deepEqual(parsed.contacts, []);
  });

  test('parseWellfoundItem normalizes raw Wellfound company item', () => {
    const raw = {
      name: 'DevZero',
      company_url: 'https://devzero.io',
      investment_type: 'Seed',
      raised: '$2.2M',
      closed_at: '2026-06-05',
      company_size: '11-50', // range or number; with fallback
      employee_count: 16,
      high_concept: 'Containerized developer environments with instant code sync and orchestration',
      timezone: 'America/Los_Angeles'
    };

    const parsed = parseWellfoundItem(raw, asOf);
    assert.equal(parsed.id, 'startup_devzero');
    assert.equal(parsed.name, 'DevZero');
    assert.equal(parsed.website, 'https://devzero.io');
    assert.equal(parsed.fundingRound, 'Seed');
    assert.equal(parsed.roundAmount, '$2.2M');
    assert.equal(parsed.fundedDate, '2026-06-05');
    assert.equal(parsed.fundedMonthsAgo, 4.6);
    assert.equal(parsed.employeeCount, 16);
    assert.equal(parsed.productDescription, 'Containerized developer environments with instant code sync and orchestration');
    assert.equal(parsed.source, 'Wellfound');
    assert.equal(parsed.timezone, 'America/Los_Angeles');
    assert.deepEqual(parsed.contacts, []);
  });
});
