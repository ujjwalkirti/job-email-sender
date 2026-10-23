import fs from 'node:fs';
import path from 'node:path';

/**
 * CampaignStore manages the persistence and querying of the seed startup cold outreach campaign.
 */
export class CampaignStore {
  /**
   * @param {string} [filePath] - Path to the campaign JSON file.
   */
  constructor(filePath = path.resolve('data/campaign.json')) {
    this.filePath = filePath;
    this.data = null;
  }

  /**
   * Loads the campaign from disk. If the file does not exist, attempts to initialize with
   * seed startups if available, or an empty campaign structure.
   *
   * @param {string} [filePath]
   * @returns {{ updatedAt: string, startups: Array<any> }}
   */
  loadCampaign(filePath = this.filePath) {
    this.filePath = filePath;

    if (!fs.existsSync(this.filePath)) {
      const defaultSeed = path.resolve('data/seed_startups_initial.json');
      if (fs.existsSync(defaultSeed)) {
        const rawSeed = fs.readFileSync(defaultSeed, 'utf8');
        this.data = JSON.parse(rawSeed);
      } else {
        this.data = {
          updatedAt: new Date().toISOString(),
          startups: []
        };
      }
      return this.data;
    }

    const raw = fs.readFileSync(this.filePath, 'utf8');
    this.data = JSON.parse(raw);
    return this.data;
  }

  /**
   * Saves the campaign data to disk.
   *
   * @param {{ updatedAt?: string, startups: Array<any> }} [data]
   * @param {string} [filePath]
   */
  saveCampaign(data = this.data, filePath = this.filePath) {
    if (data) {
      this.data = data;
    }
    if (filePath) {
      this.filePath = filePath;
    }

    if (!this.data) {
      this.data = {
        updatedAt: new Date().toISOString(),
        startups: []
      };
    }

    this.data.updatedAt = new Date().toISOString();

    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  /**
   * Retrieves a startup by its unique ID.
   *
   * @param {string} id
   * @returns {any | undefined}
   */
  getStartup(id) {
    if (!this.data) {
      this.loadCampaign();
    }
    return this.data?.startups?.find((startup) => startup.id === id);
  }

  /**
   * Updates the status and metadata for a specific contact identified by email.
   * Automatically persists changes to disk.
   *
   * @param {string} contactEmail
   * @param {string} newStatus
   * @param {object} [metadata]
   * @returns {boolean} True if found and updated, false otherwise.
   */
  updateContactStatus(contactEmail, newStatus, metadata = {}) {
    if (!this.data) {
      this.loadCampaign();
    }

    const emailToFind = contactEmail.trim().toLowerCase();
    let contactFound = null;

    for (const startup of this.data?.startups || []) {
      for (const contact of startup.contacts || []) {
        if (contact.email && contact.email.trim().toLowerCase() === emailToFind) {
          contactFound = contact;
          break;
        }
      }
      if (contactFound) break;
    }

    if (!contactFound) {
      return false;
    }

    contactFound.status = newStatus;

    if (metadata.sentAt) {
      if (newStatus === 'INITIAL_SENT') {
        contactFound.initialSentAt = metadata.sentAt;
      } else if (newStatus === 'FOLLOWUP_1_SENT') {
        contactFound.followup1SentAt = metadata.sentAt;
      } else if (newStatus === 'FOLLOWUP_2_SENT') {
        contactFound.followup2SentAt = metadata.sentAt;
      }
    }

    if (metadata.initialSentAt) {
      contactFound.initialSentAt = metadata.initialSentAt;
    }
    if (metadata.followup1SentAt) {
      contactFound.followup1SentAt = metadata.followup1SentAt;
    }
    if (metadata.followup2SentAt) {
      contactFound.followup2SentAt = metadata.followup2SentAt;
    }
    if (metadata.repliedAt) {
      contactFound.repliedAt = metadata.repliedAt;
    }
    if (metadata.notes) {
      contactFound.notes = metadata.notes;
    }

    for (const [key, value] of Object.entries(metadata)) {
      if (!['sentAt'].includes(key)) {
        contactFound[key] = value;
      }
    }

    if (Array.isArray(contactFound.history)) {
      contactFound.history.push({
        status: newStatus,
        timestamp: metadata.sentAt || metadata.timestamp || new Date().toISOString(),
        ...metadata
      });
    }

    this.saveCampaign();
    return true;
  }

  /**
   * Returns high-level summary metrics of the campaign.
   *
   * @returns {{
   *   totalStartups: number,
   *   totalContacts: number,
   *   queued: number,
   *   initialSent: number,
   *   followup1: number,
   *   followup2: number,
   *   replied: number,
   *   stopped: number
   * }}
   */
  getSummaryStats() {
    if (!this.data) {
      this.loadCampaign();
    }

    const startups = this.data?.startups || [];
    let totalContacts = 0;
    let queued = 0;
    let initialSent = 0;
    let followup1 = 0;
    let followup2 = 0;
    let replied = 0;
    let stopped = 0;

    for (const startup of startups) {
      for (const contact of startup.contacts || []) {
        totalContacts++;
        const status = (contact.status || '').toUpperCase();
        if (status === 'QUEUED') queued++;
        else if (status === 'INITIAL_SENT') initialSent++;
        else if (status === 'FOLLOWUP_1_SENT' || status === 'FOLLOWUP_1') followup1++;
        else if (status === 'FOLLOWUP_2_SENT' || status === 'FOLLOWUP_2') followup2++;
        else if (status === 'REPLIED') replied++;
        else if (status === 'STOPPED') stopped++;
      }
    }

    return {
      totalStartups: startups.length,
      totalContacts,
      queued,
      initialSent,
      followup1,
      followup2,
      replied,
      stopped
    };
  }
}
