import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateWordCount,
  validateSubject,
  validateHook,
  validateClosingQuestion,
  validateNoAttachment,
  validateEmail
} from '../src/generator/validator.js';

describe('Strict Constraint Validator', () => {
  test('validates word count strictly between 90 and 120 words', () => {
    const text80Words = new Array(80).fill('word').join(' ');
    const text95Words = new Array(95).fill('word').join(' ');
    const text120Words = new Array(120).fill('word').join(' ');
    const text130Words = new Array(130).fill('word').join(' ');

    assert.equal(validateWordCount(text80Words).valid, false);
    assert.equal(validateWordCount(text95Words).valid, true);
    assert.equal(validateWordCount(text120Words).valid, true);
    assert.equal(validateWordCount(text130Words).valid, false);
  });

  test('validates boundary conditions for word count (89, 90, 120, 121)', () => {
    assert.equal(validateWordCount(new Array(89).fill('w').join(' ')).valid, false);
    assert.equal(validateWordCount(new Array(90).fill('w').join(' ')).valid, true);
    assert.equal(validateWordCount(new Array(120).fill('w').join(' ')).valid, true);
    assert.equal(validateWordCount(new Array(121).fill('w').join(' ')).valid, false);
    assert.equal(validateWordCount(null).valid, false);
    assert.equal(validateWordCount(undefined).valid, false);
  });

  test('validates subject length strictly between 36 and 50 characters', () => {
    const sub25 = 'Quick backend inquiry'; // 21 chars
    const sub40 = 'Question regarding Acme’s backend scaling'; // 41 chars
    const sub50 = 'Question regarding Acme’s backend scaling platform'; // 50 chars
    const sub55 = 'Question regarding Acme’s backend scaling and infrastructure'; // 60 chars

    assert.equal(validateSubject(sub25).valid, false);
    assert.equal(validateSubject(sub40).valid, true);
    assert.equal(validateSubject(sub50).valid, true);
    assert.equal(validateSubject(sub55).valid, false);
  });

  test('validates boundary conditions for subject length (35, 36, 50, 51)', () => {
    assert.equal(validateSubject('a'.repeat(35)).valid, false);
    assert.equal(validateSubject('a'.repeat(36)).valid, true);
    assert.equal(validateSubject('a'.repeat(50)).valid, true);
    assert.equal(validateSubject('a'.repeat(51)).valid, false);
    assert.equal(validateSubject(null).valid, false);
    assert.equal(validateSubject(undefined).valid, false);
  });

  test('validates that line 1 is about their raise or product and not about the sender', () => {
    const validHook = "Congrats on Acme's recent $1.5M seed round to scale autonomous agents for enterprise workflows.";
    const invalidHook1 = "Hi, my name is Ujjwal and I am a software engineer.";
    const invalidHook2 = "I noticed your profile on LinkedIn and wanted to reach out.";

    assert.equal(validateHook(validHook, 'Acme', '$1.5M seed').valid, true);
    assert.equal(validateHook(invalidHook1, 'Acme', '$1.5M seed').valid, false);
    assert.equal(validateHook(invalidHook2, 'Acme', '$1.5M seed').valid, false);
  });

  test('validates exact closing question presence', () => {
    const validEnding = "Would love to share how I can help. What are you struggling to hire for right now?";
    const invalidEnding = "Let me know if you have any open roles.";

    assert.equal(validateClosingQuestion(validEnding).valid, true);
    assert.equal(validateClosingQuestion(invalidEnding).valid, false);
  });

  test('validates closing question case insensitivity and punctuation', () => {
    assert.equal(validateClosingQuestion("what are you struggling to hire for right now?").valid, true);
    assert.equal(validateClosingQuestion("WHAT ARE YOU STRUGGLING TO HIRE FOR RIGHT NOW?").valid, true);
    assert.equal(validateClosingQuestion("What are you struggling to hire for right now").valid, false);
    assert.equal(validateClosingQuestion(null).valid, false);
  });

  test('validates no attachment attached', () => {
    assert.equal(validateNoAttachment({}).valid, true);
    assert.equal(validateNoAttachment({ attachments: [] }).valid, true);
    assert.equal(validateNoAttachment({ attachments: [{ filename: 'resume.pdf' }] }).valid, false);
    assert.equal(validateNoAttachment().valid, true);
  });

  test('full email validation passes for conforming email', () => {
    const compliantSubject = 'Question regarding Acme’s backend scaling'; // 41 chars
    const compliantBody = `Congrats on Acme's recent $1.8M seed round to build autonomous customer workflows. Seeing your rapid product velocity in enterprise automation is genuinely exciting.

As an engineer specializing in high-throughput backend systems and production AI/LLM pipelines, I help seed-stage teams scale their infrastructure cleanly without slowing feature delivery. Previously, I built server-side systems handling high concurrent loads with real-time sync, and I specialize in Node.js, Python, and scalable distributed databases.

I would love to learn more about your technical roadmaps and see where I could immediately relieve engineering pressure.

What are you struggling to hire for right now?`;

    const res = validateEmail({
      subject: compliantSubject,
      bodyText: compliantBody,
      startupName: 'Acme',
      productOrRaise: 'seed round'
    });

    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
    assert.ok(res.metrics.wordCount >= 90 && res.metrics.wordCount <= 120);
    assert.ok(res.metrics.subjectLength >= 36 && res.metrics.subjectLength <= 50);
  });

  test('full email validation collects all errors when multiple constraints fail', () => {
    const res = validateEmail({
      subject: 'Too short',
      bodyText: 'I am writing to apply for a job.',
      attachments: [{ filename: 'cv.pdf' }],
      startupName: 'Acme',
      productOrRaise: '$1.5M'
    });

    assert.equal(res.valid, false);
    assert.ok(res.errors.length >= 4);
    assert.ok(res.metrics.wordCount < 90);
    assert.ok(res.metrics.subjectLength < 36);
  });
});
