import { parseEntrackrItem, parseInc42Item, parseWellfoundItem } from './parsers.js';

/**
 * Calculates elapsed months since a funding round date using standard 30.44 days/month.
 * @param {string|Date} fundedDate - Date string (YYYY-MM-DD) or Date object
 * @param {Date} [asOfDate=new Date()] - Reference comparison date
 * @returns {number} Elapsed months rounded to 1 decimal place, or NaN if invalid
 */
export function calculateFundedMonths(fundedDate, asOfDate = new Date()) {
  if (!fundedDate) return NaN;
  const funded = new Date(fundedDate);
  const asOf = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);
  if (isNaN(funded.getTime()) || isNaN(asOf.getTime())) return NaN;

  const diffMs = asOf.getTime() - funded.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const months = diffDays / 30.44;
  return Math.round(months * 10) / 10;
}

/**
 * Determines whether a startup satisfies seed-stage cold outreach criteria:
 * 1. Funding round must be Seed stage.
 * 2. Funded date must be between 2 and 9 months ago (under 2 mo: scrambling; over 9 mo: capital allocated).
 * 3. Employee count must be under 30 people (to directly reach founders & tech leads without gatekeepers).
 *
 * @param {object} startup - Startup candidate object
 * @param {string} startup.fundedDate - Date of funding round
 * @param {number} startup.employeeCount - Current headcount
 * @param {string} [startup.fundingRound] - Round classification (e.g., 'Seed')
 * @param {Date} [asOfDate=new Date()] - Reference date
 * @returns {{ eligible: boolean, reasons: string[], metrics: { fundedMonthsAgo: number|null, employeeCount: number } }}
 */
export function isEligibleSeedStartup(startup, asOfDate = new Date()) {
  if (!startup || typeof startup !== 'object') {
    return {
      eligible: false,
      reasons: ['Invalid startup record provided'],
      metrics: { fundedMonthsAgo: null, employeeCount: 0 }
    };
  }

  const reasons = [];

  // 1. Funding Round validation
  if (startup.fundingRound) {
    const isSeed = /^seed(\s+round)?$/i.test(startup.fundingRound.trim());
    if (!isSeed) {
      reasons.push(`Funding round '${startup.fundingRound}' is not Seed stage (must be Seed round)`);
    }
  } else {
    reasons.push('Funding round is missing (must be Seed stage)');
  }

  // 2. Date window validation (2 to 9 months post-raise)
  const fundedMonths = calculateFundedMonths(startup.fundedDate, asOfDate);
  if (isNaN(fundedMonths)) {
    reasons.push(`Invalid funded date: ${startup.fundedDate}`);
  } else if (fundedMonths < 2) {
    reasons.push(`Startup funded under 2 months ago (${fundedMonths} months; still scrambling post-raise)`);
  } else if (fundedMonths > 9) {
    reasons.push(`Startup funded over 9 months ago (${fundedMonths} months; capital allocated)`);
  }

  // 3. Team size / headcount validation (< 30 employees)
  if (typeof startup.employeeCount !== 'number' || isNaN(startup.employeeCount)) {
    reasons.push(`Invalid employee count: ${startup.employeeCount}`);
  } else if (startup.employeeCount >= 30) {
    reasons.push(`Team size (${startup.employeeCount}) must be under 30 people to reach founders directly without HR gatekeepers`);
  } else if (startup.employeeCount <= 0) {
    reasons.push(`Team size must be greater than 0 (got ${startup.employeeCount})`);
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    metrics: {
      fundedMonthsAgo: isNaN(fundedMonths) ? null : fundedMonths,
      employeeCount: startup.employeeCount
    }
  };
}

// Re-export parsers for convenience
export { parseEntrackrItem, parseInc42Item, parseWellfoundItem };
