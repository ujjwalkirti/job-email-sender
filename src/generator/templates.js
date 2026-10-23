const DEFAULT_SENDER = {
  senderName: 'Ujjwal Kirti',
  portfolioUrl: 'https://ujjwal-portfolio-flame.vercel.app/',
  githubUrl: 'https://github.com/ujjwalkirti'
};

/**
 * Converts plain text into clean, styled HTML email markup with hyperlinks.
 *
 * @param {string} text
 * @returns {string}
 */
export function textToHtml(text) {
  if (typeof text !== 'string') return '';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const withLinks = escaped.replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

  const paragraphs = withLinks.split(/\n\s*\n/).map(p => {
    const formatted = p.trim().replace(/\n/g, '<br/>');
    return `<p style="margin: 0 0 16px 0; line-height: 1.5;">${formatted}</p>`;
  });

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #1a1a1a;">\n${paragraphs.join('\n')}\n</div>`;
}

/**
 * Dynamically picks or formats a subject line strictly between 36 and 50 characters.
 *
 * @param {object} startup
 * @param {object} [contact]
 * @returns {string}
 */
export function generateSubject(startup, contact) {
  const startupName = (startup?.name || 'Your Team').trim();
  const isTechLead = /tech|lead|cto|engineer|architect/i.test(contact?.role || '');

  const founderTemplates = [
    name => `Question regarding ${name}'s backend scaling`,
    name => `Question regarding ${name}'s tech roadmap`,
    name => `Post-seed engineering inquiry for ${name}`,
    name => `Scaling engineering velocity at ${name}`,
    name => `Scaling backend engineering at ${name}`,
    name => `Engineering roadmap inquiry for ${name}`,
    name => `Backend scaling inquiry for ${name}`
  ];

  const techLeadTemplates = [
    name => `Question regarding ${name}'s backend systems`,
    name => `Question regarding ${name}'s backend scaling`,
    name => `Backend architecture inquiry for ${name}`,
    name => `Inquiry regarding ${name}'s backend stack`,
    name => `API & backend scaling inquiry for ${name}`,
    name => `Distributed systems inquiry for ${name}`,
    name => `Scaling backend systems at ${name}`,
    name => `Technical scaling inquiry for ${name}`
  ];

  const templates = isTechLead ? techLeadTemplates : founderTemplates;

  for (const t of templates) {
    const candidate = t(startupName);
    if (candidate.length >= 36 && candidate.length <= 50) {
      return candidate;
    }
  }

  // Fallback: guaranteed within 36 to 50 characters
  let fallback = `Question regarding ${startupName}'s backend scaling`;
  if (fallback.length > 50) {
    fallback = fallback.slice(0, 50).trim();
    if (fallback.length < 36) fallback = fallback.padEnd(36, '.');
  } else if (fallback.length < 36) {
    fallback = `Question regarding ${startupName}'s backend scaling team`;
    if (fallback.length < 36) fallback = fallback.padEnd(36, '.');
    if (fallback.length > 50) fallback = fallback.slice(0, 50);
  }

  return fallback;
}

/**
 * Builds the initial cold outreach email for Founder or TechLead.
 *
 * @param {object} startup - Startup info (name, roundAmount, fundingRound, productDescription)
 * @param {object} contact - Contact info (name, role, email)
 * @param {object} [senderProfile] - Sender info (senderName, portfolioUrl, githubUrl)
 * @returns {{ subject: string, bodyText: string, html: string }}
 */
export function generateInitialEmail(startup = {}, contact = {}, senderProfile = {}) {
  const sender = { ...DEFAULT_SENDER, ...senderProfile };
  const firstName = (contact?.name || '').trim().split(/\s+/)[0] || 'there';
  const startupName = (startup?.name || 'your startup').trim();
  const round = startup?.roundAmount ? `${startup.roundAmount} seed round` : 'recent seed round';
  const isTechLead = /tech|lead|cto|engineer|architect/i.test(contact?.role || '');

  const subject = generateSubject(startup, contact);

  let bodyText;
  if (isTechLead) {
    bodyText = `Hi ${firstName},

Congrats on ${startupName}'s recent ${round} to scale technical infrastructure.

As an engineer focused on distributed backend architectures and production AI pipelines, I specialize in reducing API latency, optimizing database query throughput, and hardening event-driven microservices. In recent projects, I built scalable backend systems handling high concurrency with sub-100ms response times across PostgreSQL and Redis. I take ownership of backend performance so your team can ship without operational bottlenecks.

You can review my open-source work on GitHub (${sender.githubUrl}) and portfolio (${sender.portfolioUrl}). I would love to learn where your engineering team currently needs the most leverage.

What are you struggling to hire for right now?

Best regards,
${sender.senderName}`;
  } else {
    bodyText = `Hi ${firstName},

Congrats on ${startupName}'s recent ${round} to accelerate product velocity.

Scaling post-seed engineering requires balancing rapid feature shipping with resilient architecture. As a backend and AI systems engineer, I help early-stage teams build dependable distributed services, optimize database throughput, and deploy production LLM workflows cleanly. In previous work, I built high-concurrency server backends with real-time data sync handling heavy user workloads.

You can review my technical projects on GitHub (${sender.githubUrl}) and portfolio (${sender.portfolioUrl}). I would love to learn about your engineering roadmap and help relieve pressure on your team.

What are you struggling to hire for right now?

Best regards,
${sender.senderName}`;
  }

  // Safety net: ensure word count is strictly between 90 and 120 words
  const words = bodyText.trim().split(/\s+/).filter(Boolean);
  if (words.length < 90) {
    const filler = ` I prioritize writing clean, maintainable systems that scale smoothly under load.`;
    bodyText = bodyText.replace('What are you struggling to hire for right now?', `${filler}\n\nWhat are you struggling to hire for right now?`);
  } else if (words.length > 120) {
    // If overly verbose, replace secondary link intro with concise format
    bodyText = bodyText.replace('You can review my open-source work on GitHub', 'See my work on GitHub');
    bodyText = bodyText.replace('You can review my technical projects on GitHub', 'See my work on GitHub');
  }

  const html = textToHtml(bodyText);

  return {
    subject,
    bodyText,
    html
  };
}
