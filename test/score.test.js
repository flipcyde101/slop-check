import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreFindings, badgeMarkdown } from '../src/score.js';

function finding(rule, weight, file) {
  return { rule, weight, message: '', file, line: 1 };
}

function repeat(count, make) {
  return Array.from({ length: count }, make);
}

test('no findings scores 0', () => {
  assert.deepEqual(scoreFindings([], 0), { score: 0, points: 0, label: 'Hand-written', color: 'brightgreen' });
});

test('one high finding over 100 lines scores 5', () => {
  const result = scoreFindings([finding('empty-catch', 5, 'a.js')], 100);
  assert.deepEqual(result, { score: 5, points: 5, label: 'Mostly human', color: 'green' });
});

test('small changes count as at least 20 lines', () => {
  const result = scoreFindings([finding('empty-catch', 5, 'a.js')], 3);
  assert.equal(result.score, 25);
  assert.equal(result.label, 'Needs a once-over');
  assert.equal(result.color, 'yellow');
});

test('em dash points stop at 5 per file', () => {
  assert.equal(scoreFindings(repeat(8, () => finding('em-dash', 1, 'a.md')), 100).points, 5);
  const twoFiles = [...repeat(8, () => finding('em-dash', 1, 'a.md')), ...repeat(2, () => finding('em-dash', 1, 'b.md'))];
  assert.equal(scoreFindings(twoFiles, 100).points, 7);
});

test('em dash points stop at 5 per commit', () => {
  const findings = repeat(7, () => ({ rule: 'em-dash', weight: 1, message: '', commit: 'abc1234' }));
  assert.equal(scoreFindings(findings, 100).points, 5);
});

test('the score is capped at 100', () => {
  const result = scoreFindings(repeat(30, () => finding('empty-catch', 5, 'a.js')), 20);
  assert.deepEqual(result, { score: 100, points: 150, label: 'Pure slop', color: 'red' });
});

test('labels change at the band edges', () => {
  const at = (score) => scoreFindings(repeat(score, () => finding('x', 1, 'a.js')), 100);
  assert.equal(at(10).color, 'green');
  assert.equal(at(11).color, 'yellow');
  assert.equal(at(30).color, 'yellow');
  assert.equal(at(31).color, 'orange');
  assert.equal(at(31).label, 'Sloppy');
  assert.equal(at(60).color, 'orange');
  assert.equal(at(61).color, 'red');
});

test('badgeMarkdown links to the repo', () => {
  assert.equal(
    badgeMarkdown(7, 'green'),
    '[![slop score](https://img.shields.io/badge/slop_score-7-green)](https://github.com/tisankanj/slop-check)',
  );
});
