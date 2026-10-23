import fs from 'node:fs';
import path from 'node:path';

/**
 * Escapes a single CSV field following RFC 4180 rules.
 *
 * @param {any} val
 * @returns {string}
 */
export function escapeCSVField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Parses RFC 4180 CSV text into an array of string arrays.
 * Handles embedded quotes (""), commas within quotes, and newlines within quotes.
 *
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCSV(text) {
  if (!text || typeof text !== 'string') return [];

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          insideQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // Filter out any trailing completely empty rows
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}

/**
 * Standard CSV headers for campaign export/import.
 */
export const CSV_HEADERS = [
  'startup_id',
  'startup_name',
  'website',
  'funding_round',
  'round_amount',
  'funded_date',
  'funded_months_ago',
  'employee_count',
  'product_description',
  'source',
  'timezone',
  'contact_id',
  'contact_name',
  'contact_role',
  'contact_email',
  'contact_status',
  'notes'
];

/**
 * Exports campaign dataset to an RFC 4180 CSV file.
 *
 * @param {object} campaignData - CampaignData object or CampaignStore instance
 * @param {string} csvFilePath - Destination CSV file path
 */
export function exportCampaignToCSV(campaignData, csvFilePath) {
  const startups = campaignData?.startups || campaignData?.data?.startups || [];
  const rows = [];

  // Header row
  rows.push(CSV_HEADERS.map(escapeCSVField).join(','));

  for (const startup of startups) {
    const contacts = startup.contacts && startup.contacts.length > 0
      ? startup.contacts
      : [null];

    for (const contact of contacts) {
      const row = [
        escapeCSVField(startup.id || ''),
        escapeCSVField(startup.name || ''),
        escapeCSVField(startup.website || ''),
        escapeCSVField(startup.fundingRound || ''),
        escapeCSVField(startup.roundAmount || ''),
        escapeCSVField(startup.fundedDate || ''),
        escapeCSVField(startup.fundedMonthsAgo ?? ''),
        escapeCSVField(startup.employeeCount ?? ''),
        escapeCSVField(startup.productDescription || ''),
        escapeCSVField(startup.source || ''),
        escapeCSVField(startup.timezone || 'Asia/Kolkata'),
        escapeCSVField(contact?.id || ''),
        escapeCSVField(contact?.name || ''),
        escapeCSVField(contact?.role || ''),
        escapeCSVField(contact?.email || ''),
        escapeCSVField(contact?.status || 'QUEUED'),
        escapeCSVField(contact?.notes || '')
      ];
      rows.push(row.join(','));
    }
  }

  const outputContent = rows.join('\r\n') + '\r\n';
  const dir = path.dirname(path.resolve(csvFilePath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(csvFilePath, outputContent, 'utf-8');
}

/**
 * Normalizes a header string for resilient case-insensitive and punctuation-insensitive matching.
 * e.g. "Startup ID", "startup_id", "startupId" all become "startupid".
 *
 * @param {string} header
 * @returns {string}
 */
function normalizeHeader(header) {
  return (header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Imports modifications from a CSV file back into the campaign data structure.
 *
 * Matches startups by startup_id (or name) and contacts by contact_id (or email/role/name).
 * Updates modified emails, names, roles, statuses, and notes while preserving history
 * and other campaign metadata.
 *
 * @param {string} csvFilePath - Path to modified CSV file
 * @param {object} currentCampaign - CampaignData object or CampaignStore instance
 * @returns {object} Updated campaign object
 */
export function importCampaignFromCSV(csvFilePath, currentCampaign) {
  if (!fs.existsSync(csvFilePath)) {
    throw new Error(`CSV file not found: ${csvFilePath}`);
  }

  const rawCSV = fs.readFileSync(csvFilePath, 'utf-8');
  const rows = parseCSV(rawCSV);

  if (rows.length === 0) {
    return currentCampaign;
  }

  const headerRow = rows[0].map(normalizeHeader);
  const dataRows = rows.slice(1);

  const getCol = (row, ...names) => {
    for (const name of names) {
      const norm = normalizeHeader(name);
      const idx = headerRow.indexOf(norm);
      if (idx !== -1 && idx < row.length) {
        return row[idx].trim();
      }
    }
    return '';
  };

  const campaign = currentCampaign?.data || currentCampaign;
  if (!campaign.startups) {
    campaign.startups = [];
  }

  for (const row of dataRows) {
    const startupId = getCol(row, 'startup_id', 'startupId', 'id');
    const startupName = getCol(row, 'startup_name', 'startupName', 'name', 'company');
    const website = getCol(row, 'website', 'url');
    const fundingRound = getCol(row, 'funding_round', 'fundingRound', 'round');
    const roundAmount = getCol(row, 'round_amount', 'roundAmount', 'amount');
    const fundedDate = getCol(row, 'funded_date', 'fundedDate', 'date');
    const fundedMonths = getCol(row, 'funded_months_ago', 'fundedMonthsAgo', 'months');
    const employeeCount = getCol(row, 'employee_count', 'employeeCount', 'employees', 'headcount');
    const productDesc = getCol(row, 'product_description', 'productDescription', 'description');
    const source = getCol(row, 'source');
    const timezone = getCol(row, 'timezone', 'tz');

    const contactId = getCol(row, 'contact_id', 'contactId');
    const contactName = getCol(row, 'contact_name', 'contactName');
    const contactRole = getCol(row, 'contact_role', 'contactRole', 'role');
    const contactEmail = getCol(row, 'contact_email', 'contactEmail', 'email');
    const contactStatus = getCol(row, 'contact_status', 'contactStatus', 'status');
    const notes = getCol(row, 'notes', 'note');

    // Find startup
    let startup = campaign.startups.find((s) => (startupId && s.id === startupId) || (startupName && s.name?.toLowerCase() === startupName.toLowerCase()));

    if (!startup) {
      startup = {
        id: startupId || `startup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: startupName || 'Unnamed Startup',
        website: website || '',
        fundingRound: fundingRound || 'Seed',
        roundAmount: roundAmount || '',
        fundedDate: fundedDate || '',
        fundedMonthsAgo: fundedMonths ? Number(fundedMonths) : 0,
        employeeCount: employeeCount ? Number(employeeCount) : 0,
        productDescription: productDesc || '',
        source: source || 'CSV Import',
        timezone: timezone || 'Asia/Kolkata',
        contacts: []
      };
      campaign.startups.push(startup);
    } else {
      if (startupName) startup.name = startupName;
      if (website) startup.website = website;
      if (fundingRound) startup.fundingRound = fundingRound;
      if (roundAmount) startup.roundAmount = roundAmount;
      if (fundedDate) startup.fundedDate = fundedDate;
      if (fundedMonths) startup.fundedMonthsAgo = Number(fundedMonths);
      if (employeeCount) startup.employeeCount = Number(employeeCount);
      if (productDesc) startup.productDescription = productDesc;
      if (source) startup.source = source;
      if (timezone) startup.timezone = timezone;
    }

    if (!Array.isArray(startup.contacts)) {
      startup.contacts = [];
    }

    // Match contact
    if (contactId || contactEmail || contactName || contactRole) {
      let contact = startup.contacts.find((c) => {
        if (contactId && c.id === contactId) return true;
        if (contactEmail && c.email && c.email.toLowerCase() === contactEmail.toLowerCase()) return true;
        if (contactRole && c.role && c.role.toLowerCase() === contactRole.toLowerCase()) return true;
        if (contactName && c.name && c.name.toLowerCase() === contactName.toLowerCase()) return true;
        return false;
      });

      if (!contact) {
        contact = {
          id: contactId || `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: contactName || '',
          role: contactRole || 'Founder',
          email: contactEmail || '',
          status: contactStatus || 'QUEUED',
          notes: notes || '',
          history: []
        };
        startup.contacts.push(contact);
      } else {
        if (contactName) contact.name = contactName;
        if (contactRole) contact.role = contactRole;
        if (contactEmail) contact.email = contactEmail;
        if (contactStatus) contact.status = contactStatus;
        if (notes !== undefined && notes !== '') contact.notes = notes;
      }
    }
  }

  campaign.updatedAt = new Date().toISOString();

  if (typeof currentCampaign?.saveCampaign === 'function') {
    currentCampaign.saveCampaign(campaign);
  }

  return currentCampaign;
}
