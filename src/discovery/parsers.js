import { calculateFundedMonths } from './filter.js';

/**
 * Generates a clean URL/identifier-safe slug from a string.
 * @param {string} text
 * @returns {string}
 */
function slugify(text) {
  if (!text) return 'startup';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Normalizes funding round strings to standard representations.
 * @param {string} round
 * @returns {string}
 */
function normalizeRound(round) {
  if (!round) return 'Seed';
  const r = String(round).trim();
  if (/^pre-?seed/i.test(r)) return 'Pre-Seed';
  if (/^seed/i.test(r)) return 'Seed';
  if (/^series\s+a/i.test(r)) return 'Series A';
  if (/^series\s+b/i.test(r)) return 'Series B';
  return r;
}

/**
 * Parses numeric employee count from numbers, strings, or range formats.
 * @param {number|string} val
 * @returns {number}
 */
function parseEmployeeCount(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const s = String(val).trim();
  const rangeMatch = s.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    return Math.round((min + max) / 2);
  }
  const match = s.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Normalizes date to YYYY-MM-DD string.
 * @param {string|Date} val
 * @returns {string}
 */
function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val).trim();
  const dmyMatch = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  }
  return s;
}

/**
 * Normalizes a raw Entrackr funding tracker entry into a standard Startup record.
 * @param {object} item
 * @param {Date} [asOfDate]
 * @returns {object}
 */
export function parseEntrackrItem(item, asOfDate) {
  if (!item || typeof item !== 'object') throw new Error('Invalid Entrackr item');
  const name = (item.company || item.name || item.company_name || item.startup || '').trim();
  const fundedDate = formatDate(item.date || item.funded_date || item.funding_date || item.fundedDate);
  const employeeCount = parseEmployeeCount(
    item.employees ?? item.employee_count ?? item.employeeCount ?? item.team_size ?? item.headcount
  );
  const fundingRound = normalizeRound(item.round || item.funding_round || item.fundingRound);

  return {
    id: item.id || `startup_${slugify(name)}`,
    name,
    website: item.website || item.url || item.website_url || '',
    fundingRound,
    roundAmount: item.amount || item.round_amount || item.funding_amount || '',
    fundedDate,
    fundedMonthsAgo: calculateFundedMonths(fundedDate, asOfDate),
    employeeCount,
    productDescription: item.productDescription || item.product_description || item.sector || item.description || item.about || '',
    source: 'Entrackr',
    timezone: item.timezone || 'Asia/Kolkata',
    contacts: Array.isArray(item.contacts) ? item.contacts : []
  };
}

/**
 * Normalizes a raw Inc42 funding deal entry into a standard Startup record.
 * @param {object} item
 * @param {Date} [asOfDate]
 * @returns {object}
 */
export function parseInc42Item(item, asOfDate) {
  if (!item || typeof item !== 'object') throw new Error('Invalid Inc42 item');
  const name = (item.startupName || item.startup_name || item.name || item.company || '').trim();
  const fundedDate = formatDate(item.dealDate || item.deal_date || item.date || item.fundedDate);
  const employeeCount = parseEmployeeCount(
    item.teamSize ?? item.team_size ?? item.employees ?? item.employee_count ?? item.headcount
  );
  const fundingRound = normalizeRound(item.stage || item.round || item.series || item.fundingRound);

  return {
    id: item.id || `startup_${slugify(name)}`,
    name,
    website: item.domain || item.website || item.url || '',
    fundingRound,
    roundAmount: item.fundingAmount || item.funding_amount || item.amount || item.deal_size || '',
    fundedDate,
    fundedMonthsAgo: calculateFundedMonths(fundedDate, asOfDate),
    employeeCount,
    productDescription: item.overview || item.productDescription || item.description || item.about || '',
    source: 'Inc42',
    timezone: item.timezone || 'Asia/Kolkata',
    contacts: Array.isArray(item.contacts) ? item.contacts : []
  };
}

/**
 * Normalizes a raw Wellfound company item into a standard Startup record.
 * @param {object} item
 * @param {Date} [asOfDate]
 * @returns {object}
 */
export function parseWellfoundItem(item, asOfDate) {
  if (!item || typeof item !== 'object') throw new Error('Invalid Wellfound item');
  const name = (item.name || item.company_name || item.company || '').trim();
  const fundedDate = formatDate(item.closed_at || item.funded_date || item.date || item.fundedDate);
  const rawCount = item.employee_count ?? item.employeeCount ?? item.employees ?? item.company_size ?? item.size;
  const employeeCount = parseEmployeeCount(rawCount);
  const fundingRound = normalizeRound(item.investment_type || item.round || item.funding_round || item.fundingRound);

  return {
    id: item.id || `startup_${slugify(name)}`,
    name,
    website: item.company_url || item.website_url || item.website || item.url || '',
    fundingRound,
    roundAmount: item.raised || item.amount || item.round_amount || '',
    fundedDate,
    fundedMonthsAgo: calculateFundedMonths(fundedDate, asOfDate),
    employeeCount,
    productDescription: item.high_concept || item.pitch || item.productDescription || item.description || '',
    source: 'Wellfound',
    timezone: item.timezone || 'America/Los_Angeles',
    contacts: Array.isArray(item.contacts) ? item.contacts : []
  };
}
