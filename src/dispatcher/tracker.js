import { getFollowup1DueDate, getFollowup2DueDate } from './scheduler.js';

/**
 * Finds a contact by email within either a CampaignStore instance or a raw campaign object.
 *
 * @param {object} store - CampaignStore instance or plain campaign dataset
 * @param {string} email - Email address of the contact to find
 * @returns {{ contact: object, startup: object } | null}
 */
function findContactInStore(store, email) {
  if (store && !store.data && typeof store.loadCampaign === 'function') {
    store.loadCampaign();
  }
  const normEmail = email?.trim().toLowerCase();
  const startups = store?.startups || store?.data?.startups || [];

  for (const startup of startups) {
    for (const contact of startup.contacts || []) {
      if (contact.email && contact.email.trim().toLowerCase() === normEmail) {
        return { contact, startup };
      }
    }
  }
  return null;
}

/**
 * Records a successful email send for a contact, transitions status,
 * computes the next follow-up due date, and logs history.
 *
 * Stage behavior:
 * - 'INITIAL': sets status to 'INITIAL_SENT', records initialSentAt, computes followup1DueDate (Day 4).
 * - 'FOLLOWUP_1': sets status to 'FOLLOWUP_1_SENT', records followup1SentAt, computes followup2DueDate (Day 9 from initial).
 * - 'FOLLOWUP_2': sets status to 'FOLLOWUP_2_SENT', records followup2SentAt, sets stopped = true.
 *
 * @param {object} store - CampaignStore instance or plain campaign dataset
 * @param {string} contactEmail - Target contact's email address
 * @param {'INITIAL' | 'FOLLOWUP_1' | 'FOLLOWUP_2'} stage - Outreach stage
 * @param {string | Date} [sentAt] - ISO timestamp or Date of send
 * @returns {object} Status update result
 */
export function recordSendSuccess(store, contactEmail, stage, sentAt = new Date().toISOString()) {
  const sentAtIso = typeof sentAt === 'string' ? sentAt : new Date(sentAt).toISOString();
  const sentDate = new Date(sentAtIso);

  const stageUpper = (stage || 'INITIAL').toUpperCase();
  let newStatus = 'INITIAL_SENT';
  const metadata = { sentAt: sentAtIso };

  if (stageUpper === 'INITIAL') {
    newStatus = 'INITIAL_SENT';
    metadata.initialSentAt = sentAtIso;
    metadata.followup1DueDate = getFollowup1DueDate(sentDate).toISOString();
  } else if (stageUpper === 'FOLLOWUP_1' || stageUpper === 'FOLLOWUP_1_SENT') {
    newStatus = 'FOLLOWUP_1_SENT';
    metadata.followup1SentAt = sentAtIso;

    // Use initialSentAt if already recorded, otherwise use sentDate as fallback
    const found = findContactInStore(store, contactEmail);
    const initialDate = found?.contact?.initialSentAt
      ? new Date(found.contact.initialSentAt)
      : sentDate;
    metadata.followup2DueDate = getFollowup2DueDate(initialDate).toISOString();
  } else if (stageUpper === 'FOLLOWUP_2' || stageUpper === 'FOLLOWUP_2_SENT') {
    newStatus = 'FOLLOWUP_2_SENT';
    metadata.followup2SentAt = sentAtIso;
    metadata.stopped = true; // Stop forever after follow-up 2
  }

  // If store is a CampaignStore instance with updateContactStatus method
  if (typeof store?.updateContactStatus === 'function') {
    const updated = store.updateContactStatus(contactEmail, newStatus, metadata);
    return { success: updated, contactEmail, status: newStatus, metadata };
  }

  // Direct in-memory mutation for plain objects
  const found = findContactInStore(store, contactEmail);
  if (!found) {
    return { success: false, error: `Contact not found: ${contactEmail}` };
  }

  const { contact } = found;
  contact.status = newStatus;
  Object.assign(contact, metadata);

  if (!Array.isArray(contact.history)) {
    contact.history = [];
  }
  contact.history.push({
    status: newStatus,
    timestamp: sentAtIso,
    stage: stageUpper,
    ...metadata
  });

  return { success: true, contactEmail, status: newStatus, contact };
}

/**
 * Marks a contact as REPLIED, stopping all further outreach.
 *
 * @param {object} store - CampaignStore instance or plain campaign dataset
 * @param {string} contactEmail - Target contact's email address
 * @param {string} [notes=''] - Optional context or notes about the reply
 * @returns {object} Status update result
 */
export function markContactReplied(store, contactEmail, notes = '') {
  const repliedAt = new Date().toISOString();
  const metadata = {
    repliedAt,
    notes,
    stopped: true
  };

  if (typeof store?.updateContactStatus === 'function') {
    const updated = store.updateContactStatus(contactEmail, 'REPLIED', metadata);
    return { success: updated, contactEmail, status: 'REPLIED', metadata };
  }

  const found = findContactInStore(store, contactEmail);
  if (!found) {
    return { success: false, error: `Contact not found: ${contactEmail}` };
  }

  const { contact } = found;
  contact.status = 'REPLIED';
  contact.repliedAt = repliedAt;
  contact.notes = notes;
  contact.stopped = true;

  if (!Array.isArray(contact.history)) {
    contact.history = [];
  }
  contact.history.push({
    status: 'REPLIED',
    timestamp: repliedAt,
    notes
  });

  return { success: true, contactEmail, status: 'REPLIED', contact };
}
