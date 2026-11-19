import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../src/rules.js';
import { checkCommit } from '../src/check.js';

const EM_DASH = String.fromCharCode(0x2014);
const DEFAULT_RULES = new Set(RULES.filter((rule) => rule.defaultOn).map((rule) => rule.id));
const ALL_RULES = new Set(RULES.map((rule) => rule.id));
const SHA = 'abc1234def5678abc1234def5678abc1234def5';

function ruleIds(message, enabled) {
  return checkCommit({ sha: SHA, message }, enabled).map((finding) => finding.rule);
}

test('flags em dashes (when on) and buzzwords in commit messages', () => {
  assert.deepEqual(ruleIds(`feat: add cache ${EM_DASH} faster reads`, ALL_RULES), ['em-dash']);
  assert.deepEqual(ruleIds(`feat: add cache ${EM_DASH} faster reads`, DEFAULT_RULES), []);
  assert.deepEqual(ruleIds('feat: supercharge retries', DEFAULT_RULES), ['buzzword']);
});

test('commit findings carry the short sha', () => {
  const findings = checkCommit({ sha: SHA, message: 'feat: supercharge retries' }, DEFAULT_RULES);
  assert.deepEqual(findings, [
    { rule: 'buzzword', weight: 1, message: 'Marketing words where plain words would do.', commit: 'abc1234' },
  ]);
});

test('ai-attribution is off by default', () => {
  const message = 'feat: add cache\n\nCo-Authored-By: Claude <noreply@anthropic.com>';
  assert.deepEqual(ruleIds(message, DEFAULT_RULES), []);
});

test('ai-attribution flags tool credit when enabled', () => {
  assert.deepEqual(ruleIds('feat: a\n\nCo-Authored-By: Claude <noreply@anthropic.com>', ALL_RULES), ['ai-attribution']);
  assert.deepEqual(ruleIds('feat: a\n\nGenerated with [Claude Code](https://claude.com/claude-code)', ALL_RULES), ['ai-attribution']);
  assert.deepEqual(ruleIds('feat: a\n\nCo-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>', ALL_RULES), ['ai-attribution']);
});

test('ai-attribution leaves human co-authors alone', () => {
  assert.deepEqual(ruleIds('feat: a\n\nCo-authored-by: Kapishan Yogarasa <240426761+kapishan-2005@users.noreply.github.com>', ALL_RULES), []);
});

test('code rules do not run on commit messages', () => {
  assert.deepEqual(ruleIds('fix: remove debugger; and console.log("debug", x)', DEFAULT_RULES), []);
});
