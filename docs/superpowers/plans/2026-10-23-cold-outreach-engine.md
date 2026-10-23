# Seed Startup Cold Outreach Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an automated, highly-personalized cold outreach engine targeting 25 seed startups (2-9 months post-raise, <30 employees) with 2 contacts each (Founder + Tech Lead), enforcing strict email constraints (90-120 words, 36-50 char subject, line 1 hook, no resume, closing question), Wednesday 9-11 AM scheduling, and Day 4 / Day 9 follow-up cadence.

**Architecture:** A modular Node.js architecture with separate packages for discovery/filtering, contact management, constraint validation, template generation, timezone-aware scheduling, Nodemailer delivery, and an interactive CLI with CSV sync.

**Tech Stack:** Node.js (v22), `node:test`, `node:assert`, `nodemailer`, `dotenv`, `csv-parser` / native CSV formatter.

**Spec:** [`docs/superpowers/specs/2026-10-23-cold-outreach-engine-design.md`](docs/superpowers/specs/2026-10-23-cold-outreach-engine-design.md)

## Global Constraints

- Word count of initial email body must be strictly between 90 and 120 words.
- Subject lines must be strictly between 36 and 50 characters long.
- Line 1 must reference the company's recent raise or product, never the sender.
- No resume or PDF attachment may be attached.
- Initial email must end with the single question: "What are you struggling to hire for right now?"
- Initial send window must be scheduled for Wednesday morning between 9:00 AM and 11:00 AM in the recipient's timezone.
- Follow-up 1 must be sent exactly on Day 4 (if no reply).
- Follow-up 2 must be sent exactly on Day 9 (if no reply), and stop forever after.
- Total campaign target: 25 startups x 2 contacts = 50 target contacts.

---

### Task 1: Sender Configuration, Defaults & Seed Campaign Dataset

**Files:**
- Create: `config/sender.json`
- Create: `config/default.json`
- Create: `data/seed_startups_initial.json`
- Create: `src/campaign/store.js`
- Test: `tests/store.test.js`

**Interfaces:**
- Produces: `CampaignStore` in `src/campaign/store.js` with methods:
  - `loadCampaign(filePath?: string): CampaignData`
  - `saveCampaign(data: CampaignData, filePath?: string): void`
  - `getStartup(id: string): Startup | undefined`
  - `updateContactStatus(contactEmail: string, newStatus: string, metadata?: object): boolean`
  - `getSummaryStats(): { totalStartups: number, totalContacts: number, queued: number, initialSent: number, followup1: number, followup2: number, replied: number, stopped: number }`

- [ ] **Step 1: Write failing unit test for `src/campaign/store.js`**

```javascript
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/store.test.js`  
Expected: FAIL (Cannot find module `../src/campaign/store.js`)

- [ ] **Step 3: Create configuration files and seed dataset (25 startups, 50 contacts)**

Create `config/sender.json`:
```json
{
  "senderName": "Ujjwal Kirti",
  "senderEmail": "ujjwalkirti@gmail.com",
  "timezone": "Asia/Kolkata",
  "portfolioUrl": "https://ujjwal-portfolio-flame.vercel.app/",
  "githubUrl": "https://github.com/ujjwalkirti",
  "linkedinUrl": "https://www.linkedin.com/in/ujjwal-kirti-562b922a0/",
  "targetRoles": [
    "Backend / Distributed Systems Engineer",
    "AI / ML Engineer"
  ],
  "coreStrengths": [
    "High-throughput backend architectures (Node.js/Go/Python, PostgreSQL, Redis)",
    "Production AI/LLM pipelines and agentic systems"
  ]
}
```

Create `config/default.json`:
```json
{
  "sendWindow": {
    "dayOfWeek": 3,
    "startHour": 9,
    "endHour": 11
  },
  "cadence": {
    "followup1Days": 4,
    "followup2Days": 9
  },
  "constraints": {
    "minWords": 90,
    "maxWords": 120,
    "minSubjectChars": 36,
    "maxSubjectChars": 50,
    "maxEmployees": 29,
    "minFundedMonths": 2,
    "maxFundedMonths": 9
  },
  "jitterMsMin": 180000,
  "jitterMsMax": 360000
}
```

Create `data/seed_startups_initial.json` with 25 curated seed-stage startups (raised 2 to 9 months ago, <30 employees, 2 contacts each: Founder + Tech Lead / CTO / AI Lead).

- [ ] **Step 4: Implement `src/campaign/store.js`**

Implement `CampaignStore` with methods `loadCampaign`, `saveCampaign`, `getStartup`, `updateContactStatus`, `getSummaryStats`.

- [ ] **Step 5: Run tests and verify PASS**

Run: `node --test tests/store.test.js`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add config/ data/ src/campaign/ tests/store.test.js
git commit -m "feat(campaign): add sender config, 25 seed startups dataset, and campaign store"
```

---

### Task 2: Strict Constraint Validator

**Files:**
- Create: `src/generator/validator.js`
- Test: `tests/validator.test.js`

**Interfaces:**
- Produces:
  - `validateWordCount(text: string): { valid: boolean, count: number, error?: string }`
  - `validateSubject(subject: string): { valid: boolean, length: number, error?: string }`
  - `validateHook(firstSentence: string, startupName: string, productOrRaise: string): { valid: boolean, error?: string }`
  - `validateClosingQuestion(text: string): { valid: boolean, error?: string }`
  - `validateNoAttachment(options: object): { valid: boolean, error?: string }`
  - `validateEmail(emailObj: { subject: string, bodyText: string, attachments?: any[], startupName: string, productOrRaise: string }): { valid: boolean, errors: string[], metrics: object }`

- [ ] **Step 1: Write failing unit test for `src/generator/validator.js`**

```javascript
// tests/validator.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateWordCount,
  validateSubject,
  validateHook,
  validateClosingQuestion,
  validateNoAttachment,
  validateEmail
} from '../src/generator/validator.js';

describe('Strict Constraint Validator', () => {
  test('validates word count strictly between 90 and 120 words', () => {
    const text80Words = new Array(80).fill('word').join(' ');
    const text95Words = new Array(95).fill('word').join(' ');
    const text120Words = new Array(120).fill('word').join(' ');
    const text130Words = new Array(130).fill('word').join(' ');

    assert.equal(validateWordCount(text80Words).valid, false);
    assert.equal(validateWordCount(text95Words).valid, true);
    assert.equal(validateWordCount(text120Words).valid, true);
    assert.equal(validateWordCount(text130Words).valid, false);
  });

  test('validates subject length strictly between 36 and 50 characters', () => {
    const sub25 = 'Quick backend inquiry'; // 21 chars
    const sub40 = 'Question regarding Acme’s backend scaling'; // 41 chars
    const sub50 = 'Question regarding Acme’s backend scaling platform'; // 50 chars
    const sub55 = 'Question regarding Acme’s backend scaling and infrastructure'; // 60 chars

    assert.equal(validateSubject(sub25).valid, false);
    assert.equal(validateSubject(sub40).valid, true);
    assert.equal(validateSubject(sub50).valid, true);
    assert.equal(validateSubject(sub55).valid, false);
  });

  test('validates that line 1 is about their raise or product and not about the sender', () => {
    const validHook = "Congrats on Acme's recent $1.5M seed round to scale autonomous agents for enterprise workflows.";
    const invalidHook1 = "Hi, my name is Ujjwal and I am a software engineer.";
    const invalidHook2 = "I noticed your profile on LinkedIn and wanted to reach out.";

    assert.equal(validateHook(validHook, 'Acme', '$1.5M seed').valid, true);
    assert.equal(validateHook(invalidHook1, 'Acme', '$1.5M seed').valid, false);
    assert.equal(validateHook(invalidHook2, 'Acme', '$1.5M seed').valid, false);
  });

  test('validates exact closing question presence', () => {
    const validEnding = "Would love to share how I can help. What are you struggling to hire for right now?";
    const invalidEnding = "Let me know if you have any open roles.";

    assert.equal(validateClosingQuestion(validEnding).valid, true);
    assert.equal(validateClosingQuestion(invalidEnding).valid, false);
  });

  test('validates no attachment attached', () => {
    assert.equal(validateNoAttachment({}).valid, true);
    assert.equal(validateNoAttachment({ attachments: [] }).valid, true);
    assert.equal(validateNoAttachment({ attachments: [{ filename: 'resume.pdf' }] }).valid, false);
  });

  test('full email validation passes for conforming email', () => {
    const compliantSubject = 'Question regarding Acme’s backend scaling'; // 41 chars
    const compliantBody = `Congrats on Acme's recent $1.8M seed round to build autonomous customer workflows. Seeing your rapid product velocity in enterprise automation is genuinely exciting.

As an engineer specializing in high-throughput backend systems and production AI/LLM pipelines, I help seed-stage teams scale their infrastructure cleanly without slowing feature delivery. Previously, I built server-side systems handling high concurrent loads with real-time sync, and I specialize in Node.js, Python, and scalable distributed databases.

I would love to learn more about your technical roadmaps and see where I could immediately relieve engineering pressure.

What are you struggling to hire for right now?`;

    const res = validateEmail({
      subject: compliantSubject,
      bodyText: compliantBody,
      startupName: 'Acme',
      productOrRaise: 'seed round'
    });

    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
    assert.ok(res.metrics.wordCount >= 90 && res.metrics.wordCount <= 120);
    assert.ok(res.metrics.subjectLength >= 36 && res.metrics.subjectLength <= 50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/validator.test.js`  
Expected: FAIL (Cannot find module `../src/generator/validator.js`)

- [ ] **Step 3: Implement `src/generator/validator.js`**

Implement strict whitespace word counter, subject char counter, line 1 hook parser, closing question regex (`/what are you struggling to hire for right now\?/i`), attachment checker, and aggregated `validateEmail` function.

- [ ] **Step 4: Run tests and verify PASS**

Run: `node --test tests/validator.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/generator/validator.js tests/validator.test.js
git commit -m "feat(validator): implement strict 90-120 word count and 36-50 char subject validation"
```

---

### Task 3: Discovery & Filter Engine

**Files:**
- Create: `src/discovery/filter.js`
- Create: `src/discovery/parsers.js`
- Test: `tests/filter.test.js`

**Interfaces:**
- Produces:
  - `isEligibleSeedStartup(startup: { fundedDate: string, employeeCount: number, fundingRound: string }, asOfDate?: Date): { eligible: boolean, reasons: string[] }`
  - `calculateFundedMonths(fundedDate: string, asOfDate?: Date): number`
  - `parseEntrackrItem(item: object): object`
  - `parseInc42Item(item: object): object`
  - `parseWellfoundItem(item: object): object`

- [ ] **Step 1: Write failing unit test for `src/discovery/filter.js`**

```javascript
// tests/filter.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isEligibleSeedStartup, calculateFundedMonths } from '../src/discovery/filter.js';

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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/filter.test.js`  
Expected: FAIL (Cannot find module `../src/discovery/filter.js`)

- [ ] **Step 3: Implement `src/discovery/filter.js` and `src/discovery/parsers.js`**

Implement precise month calculations using day diff / 30.44 days per month, team size `< 30`, and normalizer functions for Entrackr, Inc42, and Wellfound data formats.

- [ ] **Step 4: Run tests and verify PASS**

Run: `node --test tests/filter.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/discovery/ tests/filter.test.js
git commit -m "feat(discovery): implement seed round (2-9 mo) and headcount (<30) filter"
```

---

### Task 4: Template Generator & Follow-up Sequences

**Files:**
- Create: `src/generator/templates.js`
- Create: `src/generator/followups.js`
- Test: `tests/generator.test.js`

**Interfaces:**
- Produces:
  - `generateInitialEmail(startup: Startup, contact: Contact, senderProfile: SenderConfig): { subject: string, bodyText: string, html: string }`
  - `generateFollowup1(startup: Startup, contact: Contact, initialSubject: string): { subject: string, bodyText: string, html: string }`
  - `generateFollowup2(startup: Startup, contact: Contact, initialSubject: string): { subject: string, bodyText: string, html: string }`

- [ ] **Step 1: Write failing unit test for `src/generator/templates.js` and `src/generator/followups.js`**

```javascript
// tests/generator.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateInitialEmail } from '../src/generator/templates.js';
import { generateFollowup1, generateFollowup2 } from '../src/generator/followups.js';
import { validateEmail } from '../src/generator/validator.js';

describe('Template and Follow-up Generator', () => {
  const sender = {
    senderName: 'Ujjwal Kirti',
    targetRoles: ['Backend / Distributed Systems Engineer', 'AI / ML Engineer'],
    portfolioUrl: 'https://ujjwal-portfolio-flame.vercel.app/',
    githubUrl: 'https://github.com/ujjwalkirti'
  };

  const startup = {
    name: 'KiteFlow',
    roundAmount: '$2.0M',
    fundingRound: 'Seed',
    productDescription: 'Agentic workflow orchestration for backend developer teams'
  };

  const founderContact = {
    name: 'Ananya Roy',
    role: 'Founder',
    email: 'ananya@kiteflow.example'
  };

  const techLeadContact = {
    name: 'Dev Sharma',
    role: 'TechLead',
    email: 'dev@kiteflow.example'
  };

  test('generates 100% compliant email for Founder passing all validation gates', () => {
    const email = generateInitialEmail(startup, founderContact, sender);
    const validation = validateEmail({
      subject: email.subject,
      bodyText: email.bodyText,
      startupName: startup.name,
      productOrRaise: startup.roundAmount
    });

    assert.equal(validation.valid, true, `Validation failed: ${validation.errors.join('; ')}`);
    assert.ok(email.subject.length >= 36 && email.subject.length <= 50, `Subject len: ${email.subject.length}`);
    assert.ok(validation.metrics.wordCount >= 90 && validation.metrics.wordCount <= 120, `Words: ${validation.metrics.wordCount}`);
    assert.ok(email.bodyText.includes('What are you struggling to hire for right now?'));
  });

  test('generates 100% compliant email for TechLead passing all validation gates', () => {
    const email = generateInitialEmail(startup, techLeadContact, sender);
    const validation = validateEmail({
      subject: email.subject,
      bodyText: email.bodyText,
      startupName: startup.name,
      productOrRaise: startup.roundAmount
    });

    assert.equal(validation.valid, true, `Validation failed: ${validation.errors.join('; ')}`);
    assert.ok(email.subject.length >= 36 && email.subject.length <= 50);
    assert.ok(validation.metrics.wordCount >= 90 && validation.metrics.wordCount <= 120);
    assert.ok(email.bodyText.includes('What are you struggling to hire for right now?'));
  });

  test('generates concise Day 4 follow-up under 45 words in same thread', () => {
    const fu1 = generateFollowup1(startup, founderContact, 'Question regarding KiteFlow’s backend scaling');
    assert.equal(fu1.subject, 'Re: Question regarding KiteFlow’s backend scaling');
    const wordCount = fu1.bodyText.trim().split(/\s+/).length;
    assert.ok(wordCount <= 45);
    assert.ok(fu1.bodyText.includes('hire'));
  });

  test('generates polite Day 9 follow-up under 40 words with stop condition', () => {
    const fu2 = generateFollowup2(startup, founderContact, 'Question regarding KiteFlow’s backend scaling');
    assert.equal(fu2.subject, 'Re: Question regarding KiteFlow’s backend scaling');
    const wordCount = fu2.bodyText.trim().split(/\s+/).length;
    assert.ok(wordCount <= 40);
    assert.ok(fu2.bodyText.toLowerCase().includes('last note') || fu2.bodyText.toLowerCase().includes('final note'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/generator.test.js`  
Expected: FAIL (Cannot find modules)

- [ ] **Step 3: Implement `src/generator/templates.js` and `src/generator/followups.js`**

Implement parameterized templates that dynamically craft the exact text:
- Founder template focuses on rapid feature delivery and reliable architecture post-seed.
- Tech Lead template focuses on backend throughput, API latency, distributed database reliability, and production AI pipelines.
- Strictly tunes word counts to guarantee between 90 and 120 words across variable startup names and amounts.
- Generates compliant 36 to 50 character subject lines.

- [ ] **Step 4: Run tests and verify PASS**

Run: `node --test tests/generator.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/generator/ tests/generator.test.js
git commit -m "feat(generator): add compliant personalized templates and Day 4 / Day 9 follow-ups"
```

---

### Task 5: Timezone Scheduler & Dispatcher

**Files:**
- Create: `src/dispatcher/scheduler.js`
- Create: `src/dispatcher/mailer.js`
- Create: `src/dispatcher/tracker.js`
- Test: `tests/scheduler.test.js`

**Interfaces:**
- Produces:
  - `getNextWednesdaySendTime(timezone: string, fromDate?: Date): Date`
  - `getFollowup1DueDate(initialSentDate: Date): Date`
  - `getFollowup2DueDate(initialSentDate: Date): Date`
  - `getDueEmails(campaignData: CampaignData, currentTime?: Date): DueEmail[]`
  - `Mailer`: wrapper for Nodemailer with dryRun flag and jitter delay.

- [ ] **Step 1: Write failing unit test for `src/dispatcher/scheduler.js`**

```javascript
// tests/scheduler.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getNextWednesdaySendTime,
  getFollowup1DueDate,
  getFollowup2DueDate,
  getDueEmails
} from '../src/dispatcher/scheduler.js';

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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/scheduler.test.js`  
Expected: FAIL (Cannot find module `../src/dispatcher/scheduler.js`)

- [ ] **Step 3: Implement `src/dispatcher/scheduler.js`, `src/dispatcher/mailer.js`, and `src/dispatcher/tracker.js`**

Implement timezone parsing (using `Intl.DateTimeFormat` or native UTC offset calculations), Wednesday 9-11 AM calculation, Day 4 & Day 9 due calculators, Nodemailer transporter with dry-run support, and contact history loggers.

- [ ] **Step 4: Run tests and verify PASS**

Run: `node --test tests/scheduler.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/dispatcher/ tests/scheduler.test.js
git commit -m "feat(dispatcher): implement Wednesday 9-11 AM timezone scheduler and Day 4 / Day 9 cadence"
```

---

### Task 6: CSV Sync & Interactive CLI

**Files:**
- Create: `src/cli/csv_sync.js`
- Create: `src/cli/preview.js`
- Create: `src/cli/index.js`
- Modify: `package.json` (add scripts: `outreach:list`, `outreach:preview`, `outreach:send`, `outreach:export-csv`, `outreach:import-csv`)

**Interfaces:**
- Produces:
  - `exportCampaignToCSV(campaignData: CampaignData, csvFilePath: string): void`
  - `importCampaignFromCSV(csvFilePath: string, currentCampaign: CampaignData): CampaignData`
  - Interactive CLI commands for reviewing drafts with live word/char counters and dry-run sending.

- [ ] **Step 1: Write test for CSV synchronization in `tests/csv.test.js`**

```javascript
// tests/csv.test.js
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { exportCampaignToCSV, importCampaignFromCSV } from '../src/cli/csv_sync.js';

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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/csv.test.js`  
Expected: FAIL (Cannot find module `../src/cli/csv_sync.js`)

- [ ] **Step 3: Implement `src/cli/csv_sync.js`, `src/cli/preview.js`, `src/cli/index.js`**

Implement CSV import/export, color-coded preview console report showing word counts, character lengths, and status badges, and CLI commands.

- [ ] **Step 4: Update `package.json` scripts**

Add scripts:
```json
"outreach:list": "node src/cli/index.js list",
"outreach:preview": "node src/cli/index.js preview",
"outreach:send": "node src/cli/index.js send",
"outreach:export-csv": "node src/cli/index.js export-csv",
"outreach:import-csv": "node src/cli/index.js import-csv"
```

- [ ] **Step 5: Run tests and verify PASS**

Run: `node --test tests/csv.test.js`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/cli/ tests/csv.test.js package.json
git commit -m "feat(cli): add CSV import/export and preview CLI commands"
```

---

### Task 7: Complete Integration Test & End-to-End Verification

**Files:**
- Create: `tests/e2e.test.js`
- Create: `data/campaign.json` (initialized with the 25 seed startups x 2 contacts = 50 contacts)
- Create: `data/startups.csv` (exported initial sheet)

**Interfaces:**
- Verifies that:
  - Exactly 25 startups exist in the active dataset.
  - Exactly 50 contacts exist (2 contacts per startup: 1 Founder + 1 TechLead).
  - All 50 initial email drafts pass the 90-120 word count test.
  - All 50 subject lines pass the 36-50 character length test.
  - All 50 emails end with "What are you struggling to hire for right now?".
  - Dry-run dispatch successfully transitions emails to `INITIAL_SENT` with timestamps and schedules Day 4 follow-up.

- [ ] **Step 1: Write integration test `tests/e2e.test.js`**

```javascript
// tests/e2e.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CampaignStore } from '../src/campaign/store.js';
import { generateInitialEmail } from '../src/generator/templates.js';
import { validateEmail } from '../src/generator/validator.js';
import { isEligibleSeedStartup } from '../src/discovery/filter.js';

describe('End-to-End Campaign Dataset Verification', () => {
  const seedPath = path.resolve('data/seed_startups_initial.json');
  const senderPath = path.resolve('config/sender.json');

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
});
```

- [ ] **Step 2: Run all test suites and verify 100% PASS**

Run: `node --test tests/**/*.test.js`  
Expected: All tests PASS

- [ ] **Step 3: Execute preview CLI command to verify visual output**

Run: `npm run outreach:preview`  
Expected: Formatted terminal output displaying 25 startups, 50 contacts, and green PASS indicators for word count (90-120), subject length (36-50 chars), line 1 hook, and closing question.

- [ ] **Step 4: Commit**

```bash
git add data/ tests/ README.md
git commit -m "feat: complete seed startup cold outreach engine with 25 startups and 50 contacts"
```
