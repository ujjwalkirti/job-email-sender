# Seed Startup Cold Outreach Engine - Design Specification

**Date:** 2026-10-23  
**Status:** Approved  
**Author:** Ujjwal Kirti & Antigravity  

---

## 1. Executive Summary & Strategy

Cold job outreach achieves up to 8.5% conversion when done conventionally, but reaches 16–24% reply rates by compounding behavioral multipliers:
1. **Targeting Seed Stage (2 to 9 months post-raise)**: Fresh capital without bureaucratic hiring queues. Startups under 2 months are still organizing; past 9 months funds may be committed.
2. **Lean Teams (<30 headcount)**: Below 30 people, founders and engineering leaders directly read and manage their own inboxes.
3. **Multi-Contact Outreach (2 contacts per startup)**: Reaching both the Founder/CEO and the functional lead (CTO / Head of Engineering / AI Lead) lifts reply rates by +93%.
4. **Strict Constraint Messaging**:
   - Length: **90 to 120 words** strictly enforced.
   - Subject line: **36 to 50 characters** strictly validated (+32.7% lift).
   - Line 1: Dedicated to **their raise or product** (never about the sender).
   - Personalized body: Tailored to Backend / Distributed Systems & AI/ML engineering (+32.7% lift).
   - No resume attached (removes barrier/resistance).
   - Single closing question: *"What are you struggling to hire for right now?"*
5. **Wednesday 9:00 AM – 11:00 AM Dispatch**: Highest open and response engagement window.
6. **2-Step Cadence**:
   - Follow-up 1 on **Day 4** (+65.8% reply lift).
   - Follow-up 2 on **Day 9**, then stop forever.
7. **Campaign Funnel (25 startups x 2 contacts = 50 emails)**:
   - Expected replies: 8 to 12.
   - Expected intro/technical calls: 3 to 4.
   - Expected offers: 1 to 2.

---

## 2. Architecture & File Structure

```
job-email-sender/
├── config/
│   ├── sender.json                 # Sender profile (Ujjwal Kirti, Backend & AI/ML focus)
│   └── default.json                # Campaign defaults (send windows, intervals, limits)
├── data/
│   ├── campaign.json               # Main database tracking startups, contacts, timestamps, statuses
│   ├── startups.csv                # Exported / editable CSV of startups & contacts
│   └── seed_startups_initial.json  # 25 pre-verified Indian/global seed startups (<30 employees, 2-9 mo)
├── src/
│   ├── discovery/
│   │   ├── filter.js               # Validates 2-9 month date window and <30 headcount
│   │   ├── entrackr_fetcher.js     # Entrackr funding tracker scraper/parser
│   │   ├── inc42_fetcher.js        # Inc42 funding tracker parser
│   │   └── wellfound_fetcher.js    # Wellfound recently funded parser
│   ├── contacts/
│   │   ├── contact_manager.js      # Contact store & role assignment (Founder + Tech Lead)
│   │   └── email_guesser.js        # Pattern generator (first@, first.last@) & MX syntax validation
│   ├── generator/
│   │   ├── validator.js            # Strict validator (90-120 words, 36-50 char subject, hook, no resume)
│   │   ├── templates.js            # Personalized Backend & AI/ML initial templates
│   │   └── followups.js            # Day 4 and Day 9 follow-up generator
│   ├── dispatcher/
│   │   ├── scheduler.js            # Timezone-aware Wednesday 9-11 AM & Day 4/9 due calculator
│   │   ├── mailer.js               # Nodemailer Gmail transport wrapper with rate limiting / jitter
│   │   └── tracker.js              # State updater (QUEUED -> INITIAL_SENT -> FOLLOWUP_1 -> FOLLOWUP_2 -> STOPPED)
│   ├── cli/
│   │   ├── index.js                # Interactive CLI menu
│   │   ├── preview.js              # Real-time draft inspector with word/char counters
│   │   └── csv_sync.js             # Import/Export CSV synchronization
│   └── index.js                    # Core export
├── tests/
│   ├── validator.test.js           # Unit tests for strict 90-120 words & 36-50 subject
│   ├── filter.test.js              # Unit tests for date window (2-9 mo) and headcount (<30)
│   ├── scheduler.test.js           # Unit tests for Wednesday 9-11 AM and Day 4/9 calculation
│   └── generator.test.js           # Tests for role-based body personalization & closing question
├── docs/
│   └── superpowers/specs/
│       └── 2026-10-23-cold-outreach-engine-design.md
├── package.json
└── README.md
```

---

## 3. Detailed Component Specifications

### 3.1 Data Model (`data/campaign.json`)

```typescript
interface Contact {
  id: string;
  name: string;
  role: "Founder" | "TechLead";
  email: string;
  status: "QUEUED" | "INITIAL_SENT" | "FOLLOWUP_1_SENT" | "FOLLOWUP_2_SENT" | "REPLIED" | "STOPPED";
  initialSentAt?: string; // ISO8601
  followup1SentAt?: string;
  followup2SentAt?: string;
  repliedAt?: string;
  notes?: string;
}

interface Startup {
  id: string;
  name: string;
  website: string;
  fundingRound: "Seed";
  roundAmount: string;
  fundedDate: string; // YYYY-MM-DD
  fundedMonthsAgo: number;
  employeeCount: number;
  productDescription: string;
  source: string;
  timezone: string; // e.g. "Asia/Kolkata"
  contacts: [Contact, Contact]; // Exactly 2 contacts
}

interface CampaignStore {
  updatedAt: string;
  startups: Startup[];
}
```

### 3.2 Discovery & Filter Rules (`src/discovery/filter.js`)

- `isValidDateWindow(fundedDate, currentDate)`:
  - `monthsDiff = (currentDate - fundedDate) in months`
  - Condition: `monthsDiff >= 2 && monthsDiff <= 9`.
  - Less than 2 months: Startups are still scrambling post-raise, hiring pipelines are chaotic.
  - Greater than 9 months: Capital has largely been allocated.
- `isValidTeamSize(employeeCount)`:
  - Condition: `employeeCount > 0 && employeeCount < 30`.
  - 30+ headcount implies HR gatekeepers; <30 ensures founders and tech leads personally manage their inboxes.

### 3.3 Strict Constraint Generator & Validator (`src/generator/validator.js`)

Every email must strictly satisfy:
1. `validateWordCount(text)`:
   - Word count calculated by whitespace split on stripped HTML/plain text.
   - Must be `>= 90` and `<= 120`.
2. `validateSubject(subject)`:
   - Subject character length must be `>= 36` and `<= 50`.
3. `validateHook(firstSentence, startupName, productOrRaise)`:
   - Line 1 must reference the company, their recent seed round, or their specific product.
   - Line 1 must NOT start with sender introduction ("I am...", "My name is...").
4. `validateClosing(text)`:
   - Must contain the exact phrase: `what are you struggling to hire for right now?` (case-insensitive).
5. `validateAttachments(options)`:
   - Attachments array must be empty (`length === 0`).

### 3.4 Email Copy Architecture

- **Initial Email (Founder)**:
  - Line 1: Congratulates on their seed round & product milestone.
  - Body: Highlights building reliable backend systems and AI features with startup speed, reducing engineering burden.
  - Links: Portfolio / GitHub.
  - Closing: "What are you struggling to hire for right now?"
- **Initial Email (Tech Lead / CTO)**:
  - Line 1: Praises their architecture/product stack.
  - Body: Targets distributed backend scalability, database optimization, or AI/LLM integration.
  - Links: Portfolio / GitHub.
  - Closing: "What are you struggling to hire for right now?"
- **Day 4 Follow-up (Follow-up 1)**:
  - Short 35–45 words.
  - Kept in the same subject/thread (`Re: <Subject>`).
  - Restates the question briefly.
- **Day 9 Follow-up (Follow-up 2)**:
  - Short 25–35 words.
  - Final polite note, acknowledges they are busy, wishes them well, stops outreach.

### 3.5 Dispatcher & Scheduler (`src/dispatcher/scheduler.js`)

- **Timing Rules**:
  - Initial outreach is scheduled for **Wednesday morning, 9:00 AM – 11:00 AM** in recipient's timezone.
  - Jitter: Each email in the queue is spaced by 3–5 minutes to avoid rate-limiting or spam flags.
  - Follow-up 1: Due `initialSentAt + 4 days` between 9:00 AM and 11:00 AM.
  - Follow-up 2: Due `initialSentAt + 9 days` between 9:00 AM and 11:00 AM.
  - If contact status is `REPLIED`, subsequent follow-ups are cancelled immediately.

---

## 4. Testing Strategy

1. **Unit Tests (Node test runner / Vitest / Jest)**:
   - `validator.test.js`: Validates 90–120 word boundary conditions, 36–50 subject character lengths, line 1 hook, closing question.
   - `filter.test.js`: Validates month differences (under 2 rejected, 2-9 accepted, 10+ rejected) and team size boundary (<30).
   - `scheduler.test.js`: Validates next Wednesday 9-11 AM calculation, Day 4 calculation, Day 9 calculation, and timezone offsets.
2. **End-to-End Dry Run**:
   - `npm run outreach:preview` prints all 50 generated emails with pass/fail badges on every constraint.
   - `npm run outreach:send -- --dry-run` simulates the dispatch without sending real emails.
