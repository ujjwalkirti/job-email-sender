// tests/generator.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generateInitialEmail, generateSubject, textToHtml } from '../src/generator/templates.js';
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

  test('preserves thread subject without prepending duplicate Re: prefix', () => {
    const fu1 = generateFollowup1(startup, founderContact, 'Re: Question regarding KiteFlow’s backend scaling');
    assert.equal(fu1.subject, 'Re: Question regarding KiteFlow’s backend scaling');

    const fu2 = generateFollowup2(startup, founderContact, 'Re: Question regarding KiteFlow’s backend scaling');
    assert.equal(fu2.subject, 'Re: Question regarding KiteFlow’s backend scaling');
  });

  test('generates HTML containing links and proper paragraph tags', () => {
    const email = generateInitialEmail(startup, founderContact, sender);
    assert.ok(email.html.includes('<p'));
    assert.ok(email.html.includes(sender.githubUrl));
    assert.ok(email.html.includes(sender.portfolioUrl));
    assert.ok(email.html.includes('href='));
  });

  test('generates 100% compliant emails for all 25 seed startups (50 contacts)', () => {
    const seedPath = path.resolve('data/seed_startups_initial.json');
    assert.ok(fs.existsSync(seedPath), 'seed_startups_initial.json must exist');
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

    for (const s of seedData.startups) {
      for (const contact of s.contacts) {
        const email = generateInitialEmail(s, contact, sender);
        const validation = validateEmail({
          subject: email.subject,
          bodyText: email.bodyText,
          startupName: s.name,
          productOrRaise: s.roundAmount
        });

        assert.equal(
          validation.valid,
          true,
          `Failed for ${s.name} (${contact.role}): ${validation.errors.join('; ')}`
        );
        assert.ok(email.subject.length >= 36 && email.subject.length <= 50);
        assert.ok(validation.metrics.wordCount >= 90 && validation.metrics.wordCount <= 120);
        assert.ok(email.bodyText.includes('What are you struggling to hire for right now?'));

        // Also verify follow-ups for all contacts
        const fu1 = generateFollowup1(s, contact, email.subject, sender);
        const fu1Words = fu1.bodyText.trim().split(/\s+/).length;
        assert.ok(fu1Words <= 45, `FU1 word count ${fu1Words} > 45 for ${s.name}`);

        const fu2 = generateFollowup2(s, contact, email.subject, sender);
        const fu2Words = fu2.bodyText.trim().split(/\s+/).length;
        assert.ok(fu2Words <= 40, `FU2 word count ${fu2Words} > 40 for ${s.name}`);
      }
    }
  });
});
