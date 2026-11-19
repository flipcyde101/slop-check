import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatText, formatJson } from '../src/report.js';

const RESULT = {
  base: 'origin/main',
  mode: 'branch',
  files: 2,
  addedLines: 120,
  score: 7,
  label: 'Mostly human',
  color: 'green',
  findings: [
    { rule: 'empty-catch', weight: 5, message: 'Error swallowed. Log it, handle it, or let it throw.', file: 'src/user.js', line: 57 },
    { rule: 'em-dash', weight: 1, message: 'The em dash is the best-known sign of unedited AI text.', commit: 'abc1234' },
    { rule: 'restating-comment', weight: 1, message: 'Comment repeats the next line. Say why, or delete it.', file: 'src/user.js', line: 42 },
    { rule: 'buzzword', weight: 1, message: 'Marketing words where plain words would do.', file: 'README.md', line: 3 },
  ],
};

test('text report lists files in path order, lines in order, then commits', () => {
  const text = formatText(RESULT, { color: false });
  const order = ['README.md', 'src/user.js', '  42  restating-comment', '  57  empty-catch', 'commit abc1234'].map((part) => text.indexOf(part));
  for (const index of order) {
    assert.ok(index >= 0, text);
  }
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test('text report has the header, score and counts', () => {
  const text = formatText(RESULT, { color: false });
  assert.match(text, /^slop-check {2}changes since origin\/main {2}2 files, 120 added lines\n/);
  assert.match(text, /Slop score: 7\/100 {2}Mostly human/);
  assert.match(text, /1 high, 0 medium, 3 low\./);
});

test('text report without colour has no escape codes', () => {
  assert.ok(!formatText(RESULT, { color: false }).includes('\x1b['));
  assert.ok(formatText(RESULT, { color: true }).includes('\x1b['));
});

test('text report says when there is nothing to check', () => {
  const empty = { ...RESULT, base: null, files: 0, addedLines: 0, findings: [], score: 0, label: 'Hand-written' };
  const text = formatText(empty, { color: false });
  assert.match(text, /Nothing to check\./);
  assert.match(text, /--all/);
});

test('json report has the documented keys', () => {
  const parsed = JSON.parse(formatJson(RESULT));
  assert.deepEqual(Object.keys(parsed), ['score', 'label', 'base', 'mode', 'files', 'addedLines', 'findings']);
  assert.equal(parsed.findings.length, 4);
});
