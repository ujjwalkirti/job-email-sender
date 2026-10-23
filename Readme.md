# Seed Startup Cold Outreach Engine

A specialized, constraint-driven cold outreach system designed for engineering job outreach to recently funded seed-stage startups.

The engine automates discovery filtering, dual-contact targeting (Founder + Tech Lead), strict constraint email generation, timezone-aware scheduling, a 3-touch follow-up cadence, and two-way CSV/Google Sheets synchronization.

---

## Key Features & Constraints

- **Strict Seed Filtering:** Only targets companies with **< 30 employees** funded **2 to 9 months ago** in a verified **Seed round** (avoiding immediate post-raise scramble and late-stage capital allocation).
- **Dual-Contact Targeting:** Reaches exactly **2 decision makers** per startup:
  - **Founder:** High-level product velocity, team scaling, and hiring bottlenecks.
  - **Tech Lead:** Distributed backend architectures, low-latency APIs, database query throughput, and infrastructure reliability.
- **Strict Copywriting Gates (100% Automated Enforcement):**
  - **Word count:** Strictly **90 to 120 words** (concise, scannable, respectful of executive time).
  - **Subject line:** Strictly **36 to 50 characters** (high mobile open rates, avoids clickbait).
  - **Line 1 hook:** Always references the startup's specific raise or product milestone (never starts with *"My name is..."*).
  - **Closing question:** Exactly *"What are you struggling to hire for right now?"*.
  - **Clean links:** Direct links to Portfolio and GitHub, with **zero attachments / no resume attached** (avoids spam filters and gatekeeper rejection).
- **Timezone-Aware Cadence & Follow-up Scheduling:**
  - Initial emails scheduled for **Wednesday mornings between 9:00 AM and 11:00 AM** in the recipient's local timezone (`Asia/Kolkata`, `America/Los_Angeles`, `America/New_York`, `Europe/London`).
  - **Day 4 Follow-up 1:** Polite 1-to-2 sentence bump (< 45 words) in the identical email thread.
  - **Day 9 Follow-up 2:** Final graceful bump (< 50 words) acknowledging priorities and permanently halting sequence.
  - **Auto-Stop on Reply:** Immediately halts all follow-ups when a reply is recorded.
- **Safety First:**
  - Default dry-run mode (`--dry-run`) prevents accidental email delivery during testing.
  - Rate limiting with 500ms delay between consecutive dispatches.
  - Pre-flight validation gate blocks any non-compliant draft from being sent.

---

## Active Dataset

The initial campaign is populated with **25 verified seed-stage startups** (India, US, UK) across distributed systems, AI/ML infrastructure, developer tooling, and enterprise platforms:

| Metric | Target | Current |
|---|---|---|
| Total Seed Startups | 25 | 25 |
| Total Decision Makers | 50 (2 per startup) | 50 (25 Founders + 25 Tech Leads) |
| Word Count Compliance | 90 - 120 words | 50 / 50 (100% PASS) |
| Subject Length Compliance | 36 - 50 characters | 50 / 50 (100% PASS) |
| Closing Call Compliance | Exact Question | 50 / 50 (100% PASS) |

Active dataset stores:
- `data/seed_startups_initial.json`: Curated raw dataset.
- `data/campaign.json`: Active campaign tracking store with status & history.
- `data/startups.csv`: Synchronized tabular sheet for spreadsheet review.

---

## Installation & Setup

1. **Clone repository and install dependencies:**
   ```bash
   git clone https://github.com/ujjwalkirti/job-email-sender.git
   cd job-email-sender
   npm install
   ```

2. **Configure Sender Profile:**
   Edit `config/sender.json` with your details:
   ```json
   {
     "senderName": "Ujjwal Kirti",
     "senderEmail": "ujjwalkirti@gmail.com",
     "timezone": "Asia/Kolkata",
     "portfolioUrl": "https://ujjwal-portfolio-flame.vercel.app/",
     "githubUrl": "https://github.com/ujjwalkirti",
     "linkedinUrl": "https://www.linkedin.com/in/ujjwal-kirti-562b922a0/"
   }
   ```

3. **Configure Mailer Environment (Optional for live sending):**
   Copy `.env.example` to `.env` and fill in your SMTP credentials:
   ```env
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_specific_password
   ```

---

## CLI Commands

The engine provides an interactive CLI for previewing, filtering, dispatching, and managing contacts:

### 1. Preview Drafts & Validation Gates
Inspect generated drafts with real-time pass/fail metric badges:
```bash
# Preview all 50 drafts
npm run outreach:preview

# Preview first 5 drafts
node src/cli/index.js preview --limit=5

# Preview drafts for a specific startup
node src/cli/index.js preview --startup="Sarvam AI"

# Compact preview without full body text
node src/cli/index.js preview --no-body
```

### 2. Campaign Summary & Contact List
List campaign progress and filter by contact status or company:
```bash
# View summary table and full list
npm run outreach:list

# Filter by contact status
node src/cli/index.js list --status=QUEUED
node src/cli/index.js list --status=INITIAL_SENT
node src/cli/index.js list --status=REPLIED

# Filter by company name
node src/cli/index.js list --startup="Portkey"
```

### 3. Dispatch Engine
Simulate or execute email dispatches with automatic safety checks:
```bash
# Dry run (default safety mode - no actual emails sent)
npm run outreach:send

# Force evaluation of all QUEUED contacts in dry-run mode
node src/cli/index.js send --force

# Send single contact in dry run
node src/cli/index.js send --email="manu@karya.in"

# Live dispatch (requires valid credentials in .env)
node src/cli/index.js send --live --force --limit=5
```

### 4. Record Replies & Stop Follow-ups
When a recipient responds, record the reply to halt future follow-ups:
```bash
node src/cli/index.js reply manu@karya.in "Scheduled introductory call for Tuesday"
```

### 5. CSV / Google Sheets Two-Way Synchronization
Export campaign contacts to CSV for spreadsheet editing and re-import updates:
```bash
# Export campaign data to data/startups.csv
npm run outreach:export-csv

# Import manual edits (status, notes, emails) from CSV
npm run outreach:import-csv
```

---

## Architecture & Directory Structure

```
job-email-sender/
├── config/
│   └── sender.json               # Sender profile and portfolio links
├── data/
│   ├── seed_startups_initial.json # Master curated 25 seed startups
│   ├── campaign.json             # Live campaign state & contact histories
│   └── startups.csv              # Synchronized spreadsheet view
├── src/
│   ├── campaign/
│   │   └── store.js              # CampaignStore persistence & query methods
│   ├── cli/
│   │   ├── csv_sync.js           # Bidirectional CSV export/import parser
│   │   ├── index.js              # Command-line router & entry point
│   │   └── preview.js            # Visual terminal formatter & validation badges
│   ├── discovery/
│   │   ├── filter.js             # Eligibility engine (Seed, 2-9 mos, <30 emps)
│   │   └── parsers.js            # Ingestion parsers (Inc42, Entrackr, Wellfound)
│   ├── dispatcher/
│   │   ├── mailer.js             # Nodemailer wrapper with rate-limiting & dry-run
│   │   ├── scheduler.js          # Timezone calculator (Wed 9-11 AM, Day 4, Day 9)
│   │   └── tracker.js            # Status transitions, reply tracking, history
│   └── generator/
│       ├── followups.js          # Day 4 and Day 9 threaded follow-up templates
│       ├── templates.js          # Founder & TechLead tailored email templates
│       └── validator.js          # Strict constraint validator (word count, subject)
└── tests/
    ├── csv.test.js               # CSV sync & escape unit tests
    ├── e2e.test.js               # Full integration & end-to-end campaign tests
    ├── filter.test.js            # Discovery filter and eligibility tests
    ├── generator.test.js         # Template generation & follow-up tests
    ├── scheduler.test.js         # Timezone scheduling & tracker tests
    ├── store.test.js             # Store CRUD & query tests
    └── validator.test.js         # Strict constraint validator boundary tests
```

---

## Testing

Run the comprehensive test suite (64 unit and integration tests across 11 test suites):

```bash
# Run all test suites
npm test

# Run end-to-end integration test only
node --test tests/e2e.test.js
```

---

## License

ISC © Ujjwal Kirti
