#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CampaignStore } from '../campaign/store.js';
import { Mailer } from '../dispatcher/mailer.js';
import { getDueEmails } from '../dispatcher/scheduler.js';
import { recordSendSuccess, markContactReplied } from '../dispatcher/tracker.js';
import { generateInitialEmail } from '../generator/templates.js';
import { generateFollowup1, generateFollowup2 } from '../generator/followups.js';
import { validateEmail } from '../generator/validator.js';
import { exportCampaignToCSV, importCampaignFromCSV } from './csv_sync.js';
import { previewCampaign, printDraftPreview, colors } from './preview.js';

const c = colors;

/**
 * Loads the sender configuration from config/sender.json.
 *
 * @returns {object}
 */
export function loadSenderConfig() {
  const senderFile = path.resolve('config/sender.json');
  if (fs.existsSync(senderFile)) {
    try {
      return JSON.parse(fs.readFileSync(senderFile, 'utf-8'));
    } catch {
      // Fallback
    }
  }
  return {
    senderName: 'Ujjwal Kirti',
    senderEmail: 'ujjwalkirti@gmail.com',
    portfolioUrl: 'https://ujjwal-portfolio-flame.vercel.app/',
    githubUrl: 'https://github.com/ujjwalkirti'
  };
}

/**
 * Parses command-line arguments into a command and flags.
 *
 * @param {string[]} args
 * @returns {{ command: string, flags: Record<string, string | boolean>, positional: string[] }}
 */
export function parseArgs(args = []) {
  let command = 'help';
  const flags = {};
  const positional = [];

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const parts = arg.slice(2).split('=');
      const key = parts[0];
      const val = parts.length > 1 ? parts.slice(1).join('=') : true;
      flags[key] = val;
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      flags[key] = true;
    } else if (!command || command === 'help') {
      command = arg;
    } else {
      positional.push(arg);
    }
  }

  return { command, flags, positional };
}

/**
 * Handles the 'list' command.
 */
export function handleList(store, flags = {}) {
  const data = store.data || store.loadCampaign();
  const stats = store.getSummaryStats();

  console.log(`\n${c.bold}${c.cyan}=================== COLD OUTREACH CAMPAIGN SUMMARY ===================${c.reset}`);
  console.log(`Total Startups:   ${c.bold}${stats.totalStartups}${c.reset}`);
  console.log(`Total Contacts:   ${c.bold}${stats.totalContacts}${c.reset}`);
  console.log(`Queued:           ${c.yellow}${stats.queued}${c.reset}`);
  console.log(`Initial Sent:     ${c.blue}${stats.initialSent}${c.reset}`);
  console.log(`Follow-up 1 Sent: ${c.magenta}${stats.followup1}${c.reset}`);
  console.log(`Follow-up 2 Sent: ${c.dim}${stats.followup2}${c.reset}`);
  console.log(`Replied:          ${c.green}${c.bold}${stats.replied}${c.reset}`);
  console.log(`Stopped:          ${c.red}${stats.stopped}${c.reset}`);
  console.log(`${c.cyan}======================================================================${c.reset}\n`);

  const statusFilter = typeof flags.status === 'string' ? flags.status.toUpperCase() : null;
  const startupFilter = typeof flags.startup === 'string' ? flags.startup.toLowerCase() : null;

  for (const startup of data.startups || []) {
    if (startupFilter && !startup.name?.toLowerCase().includes(startupFilter)) {
      continue;
    }

    const matchingContacts = (startup.contacts || []).filter((contact) => {
      if (statusFilter && (contact.status || 'QUEUED').toUpperCase() !== statusFilter) {
        return false;
      }
      return true;
    });

    if (matchingContacts.length === 0 && (statusFilter || startupFilter)) {
      continue;
    }

    console.log(`${c.bold}${startup.name}${c.reset} (${startup.roundAmount || 'Seed'}, ${startup.employeeCount || '?'} emps, ${startup.timezone || 'Asia/Kolkata'})`);
    console.log(`  ${c.dim}${startup.productDescription || ''}${c.reset}`);

    for (const contact of startup.contacts || []) {
      const statusColor = contact.status === 'REPLIED' ? c.green :
        contact.status === 'INITIAL_SENT' ? c.blue :
        contact.status === 'STOPPED' ? c.red : c.yellow;

      console.log(`  * ${contact.name} [${contact.role}] <${contact.email}> - ${statusColor}${contact.status || 'QUEUED'}${c.reset}`);
      if (contact.notes) {
        console.log(`    ${c.dim}Notes: ${contact.notes}${c.reset}`);
      }
    }
    console.log('');
  }
}

/**
 * Handles the 'preview' command.
 */
export function handlePreview(store, flags = {}) {
  const data = store.data || store.loadCampaign();
  const sender = loadSenderConfig();

  const limit = flags.limit ? Number(flags.limit) : 50;
  const startupFilter = typeof flags.startup === 'string' ? flags.startup : undefined;
  const statusFilter = typeof flags.status === 'string' ? flags.status : undefined;
  const showBody = flags['no-body'] ? false : true;

  previewCampaign(data, sender, {
    limit,
    startupFilter,
    statusFilter,
    showBody
  });
}

/**
 * Handles the 'send' command.
 */
export async function handleSend(store, flags = {}) {
  const storeData = store.data || store.loadCampaign();
  const sender = loadSenderConfig();

  // Safety first: dry-run by default unless explicitly --live
  const isLive = Boolean(flags.live) && !flags['dry-run'];
  const dryRun = !isLive;

  console.log(`\n${c.bold}Outreach Dispatch Engine Starting...${c.reset}`);
  console.log(`Mode: ${dryRun ? `${c.yellow}${c.bold}[DRY RUN] (No live emails sent)${c.reset}` : `${c.red}${c.bold}[LIVE DISPATCH]${c.reset}`}`);

  const mailer = new Mailer({ dryRun });
  let dueList = getDueEmails(storeData, new Date());

  // If force flag is provided or email flag provided, pick queued contacts
  if (flags.email) {
    const targetEmail = String(flags.email).trim().toLowerCase();
    dueList = [];
    for (const startup of storeData.startups || []) {
      for (const contact of startup.contacts || []) {
        if (contact.email?.toLowerCase() === targetEmail) {
          dueList.push({
            startup,
            contact,
            stage: contact.status === 'INITIAL_SENT' ? 'FOLLOWUP_1' : contact.status === 'FOLLOWUP_1_SENT' ? 'FOLLOWUP_2' : 'INITIAL',
            scheduledTime: new Date(),
            dueAt: new Date(),
            email: contact.email,
            contactId: contact.id,
            startupName: startup.name
          });
        }
      }
    }
  } else if (flags.force && dueList.length === 0) {
    console.log(`${c.dim}--force flag detected: queuing all INITIAL stage QUEUED contacts for evaluation.${c.reset}`);
    for (const startup of storeData.startups || []) {
      for (const contact of startup.contacts || []) {
        if ((contact.status || 'QUEUED') === 'QUEUED') {
          dueList.push({
            startup,
            contact,
            stage: 'INITIAL',
            scheduledTime: new Date(),
            dueAt: new Date(),
            email: contact.email,
            contactId: contact.id,
            startupName: startup.name
          });
        }
      }
    }
  }

  if (dueList.length === 0) {
    console.log(`${c.yellow}No emails are currently due for dispatch.${c.reset}`);
    console.log(`${c.dim}(Tip: Use --force to simulate sending all QUEUED contacts right now.)${c.reset}\n`);
    return { sentCount: 0, results: [] };
  }

  const limit = flags.limit ? Number(flags.limit) : dueList.length;
  const toSend = dueList.slice(0, limit);

  console.log(`Found ${c.bold}${toSend.length}${c.reset} due email(s) to process.\n`);

  const results = [];
  let dispatched = 0;

  for (const item of toSend) {
    const { startup, contact, stage } = item;
    let emailDraft;

    if (stage === 'INITIAL') {
      emailDraft = generateInitialEmail(startup, contact, sender);
    } else if (stage === 'FOLLOWUP_1') {
      emailDraft = generateFollowup1(startup, contact, contact.initialSubject, sender);
    } else if (stage === 'FOLLOWUP_2') {
      emailDraft = generateFollowup2(startup, contact, contact.initialSubject, sender);
    }

    // Pre-flight strict constraint gate
    if (stage === 'INITIAL') {
      const validation = validateEmail({
        subject: emailDraft.subject,
        bodyText: emailDraft.bodyText,
        startupName: startup.name,
        productOrRaise: startup.roundAmount
      });

      if (!validation.valid) {
        console.error(`${c.red}[BLOCKED] Validation failed for ${contact.email}: ${validation.errors.join(', ')}${c.reset}`);
        continue;
      }
    }

    try {
      const sendResult = await mailer.sendEmail({
        to: contact.email,
        subject: emailDraft.subject,
        text: emailDraft.bodyText,
        html: emailDraft.html
      });

      // Update tracker and campaign store
      recordSendSuccess(store, contact.email, stage, sendResult.timestamp);

      // Record subject line for thread preservation in future follow-ups
      if (stage === 'INITIAL') {
        contact.initialSubject = emailDraft.subject;
        store.saveCampaign();
      }

      dispatched++;
      const tag = dryRun ? `${c.yellow}[DRY RUN]${c.reset}` : `${c.green}[SENT]${c.reset}`;
      console.log(`${tag} Stage: ${stage} -> ${contact.name} <${contact.email}> (${startup.name}) [Delay: ${sendResult.delayAppliedMs}ms, ID: ${sendResult.messageId}]`);

      results.push({ item, sendResult, success: true });
    } catch (err) {
      console.error(`${c.red}[ERROR] Failed to send to ${contact.email}: ${err.message}${c.reset}`);
      results.push({ item, success: false, error: err.message });
    }
  }

  console.log(`\n${c.bold}${c.green}✓ Dispatch complete: ${dispatched} / ${toSend.length} emails processed successfully.${c.reset}\n`);
  return { sentCount: dispatched, results };
}

/**
 * Handles the 'reply' command.
 */
export function handleReply(store, args = [], flags = {}) {
  const email = args[0] || flags.email;
  const notes = args.slice(1).join(' ') || (flags.notes ? String(flags.notes) : 'Received response via outreach');

  if (!email) {
    console.error(`${c.red}Error: Contact email is required. Usage: node src/cli/index.js reply <email> [notes]${c.reset}`);
    return false;
  }

  const result = markContactReplied(store, email, notes);
  if (result.success) {
    console.log(`${c.green}${c.bold}✓ Contact <${email}> successfully marked as REPLIED.${c.reset}`);
    console.log(`${c.dim}Notes: "${notes}" - All future follow-ups stopped permanently.${c.reset}\n`);
    return true;
  } else {
    console.error(`${c.red}Failed to mark contact: ${result.error || 'Contact not found'}${c.reset}`);
    return false;
  }
}

/**
 * Handles the 'export-csv' command.
 */
export function handleExportCsv(store, flags = {}) {
  const outPath = typeof flags.out === 'string' ? path.resolve(flags.out) : path.resolve('data/startups.csv');
  const campaign = store.data || store.loadCampaign();

  exportCampaignToCSV(campaign, outPath);

  const contactCount = (campaign.startups || []).reduce((acc, s) => acc + (s.contacts?.length || 0), 0);
  console.log(`${c.green}${c.bold}✓ Export successful:${c.reset} Exported ${c.bold}${contactCount}${c.reset} contacts from ${c.bold}${campaign.startups?.length || 0}${c.reset} startups to:`);
  console.log(`  ${c.cyan}${outPath}${c.reset}\n`);
  return outPath;
}

/**
 * Handles the 'import-csv' command.
 */
export function handleImportCsv(store, flags = {}) {
  const inPath = typeof flags.in === 'string' ? path.resolve(flags.in) : path.resolve('data/startups.csv');

  if (!fs.existsSync(inPath)) {
    console.error(`${c.red}Error: CSV file not found at ${inPath}${c.reset}`);
    return false;
  }

  store.loadCampaign();
  importCampaignFromCSV(inPath, store);

  const updatedStats = store.getSummaryStats();
  console.log(`${c.green}${c.bold}✓ Import successful:${c.reset} Updated campaign from:`);
  console.log(`  ${c.cyan}${inPath}${c.reset}`);
  console.log(`Campaign now has ${c.bold}${updatedStats.totalStartups}${c.reset} startups and ${c.bold}${updatedStats.totalContacts}${c.reset} contacts.\n`);
  return true;
}

/**
 * Prints CLI usage instructions.
 */
export function printHelp() {
  console.log(`
${c.bold}${c.cyan}Cold Outreach Engine CLI${c.reset}
Usage: node src/cli/index.js <command> [options]

${c.bold}Available Commands:${c.reset}
  ${c.bold}list${c.reset}                      List campaign startups, contacts, statuses, and summary metrics.
                            Options: --status=<STATUS>, --startup=<NAME>

  ${c.bold}preview${c.reset}                   Interactive preview with live character, word counts, and pass/fail badges.
                            Options: --limit=<N>, --startup=<NAME>, --status=<STATUS>, --no-body

  ${c.bold}send${c.reset}                      Execute cold outreach dispatches with rate-limiting jitter.
                            Options: --dry-run (default: true), --live, --force, --limit=<N>, --email=<EMAIL>

  ${c.bold}reply <email> [notes]${c.reset}     Record a reply from a contact and stop subsequent follow-ups.

  ${c.bold}export-csv${c.reset}                Export campaign dataset to CSV for editing in Excel / Google Sheets.
                            Options: --out=<PATH> (default: data/startups.csv)

  ${c.bold}import-csv${c.reset}                Import edited CSV back into campaign.json.
                            Options: --in=<PATH> (default: data/startups.csv)

  ${c.bold}help${c.reset}                      Show this help message.
`);
}

/**
 * Main CLI entry point.
 *
 * @param {string[]} rawArgs
 */
export async function main(rawArgs = process.argv.slice(2)) {
  const { command, flags, positional } = parseArgs(rawArgs);
  const store = new CampaignStore();

  switch (command.toLowerCase()) {
    case 'list':
      handleList(store, flags);
      break;

    case 'preview':
      handlePreview(store, flags);
      break;

    case 'send':
      await handleSend(store, flags);
      break;

    case 'reply':
      handleReply(store, positional, flags);
      break;

    case 'export-csv':
    case 'exportcsv':
      handleExportCsv(store, flags);
      break;

    case 'import-csv':
    case 'importcsv':
      handleImportCsv(store, flags);
      break;

    case 'help':
    default:
      printHelp();
      break;
  }
}

// Auto-run if executed directly as entrypoint
if (process.argv[1] && (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) || process.argv[1].endsWith('src/cli/index.js') || process.argv[1].endsWith('src\\cli\\index.js'))) {
  main().catch((err) => {
    console.error('Fatal CLI Error:', err);
    process.exit(1);
  });
}
