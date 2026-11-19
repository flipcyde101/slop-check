import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeDirtyBranch } from './helpers.js';

const BIN = fileURLToPath(new URL('../bin/slop-check.js', import.meta.url));

function run(cwd, args, env = {}) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '', ...env },
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('--version prints the package version', () => {
  assert.equal(run(tmpdir(), ['--version']).stdout.trim(), '1.0.0');
});

test('--help lists every flag', () => {
  const { stdout, code } = run(tmpdir(), ['--help']);
  assert.equal(code, 0);
  for (const flag of ['--staged', '--all', '--json', '--badge', '--max-score', '--list-rules', '--no-color', '--help', '--version']) {
    assert.ok(stdout.includes(flag), flag);
  }
});

test('--list-rules lists all 14 rules with weight and status', () => {
  const { stdout } = run(tmpdir(), ['--list-rules']);
  const rows = stdout.trim().split('\n');
  assert.equal(rows.length, 14);
  assert.match(stdout, /empty-catch\s+high\s+on/);
  assert.match(stdout, /ai-attribution\s+high\s+off/);
});

test('a dirty branch prints the score and exits 0', () => {
  const { stdout, code } = run(makeDirtyBranch(), []);
  assert.equal(code, 0);
  assert.match(stdout, /Slop score: 25\/100/);
});

test('--max-score fails when the score is above it', () => {
  assert.equal(run(makeDirtyBranch(), ['--max-score', '0']).code, 1);
  assert.equal(run(makeDirtyBranch(), ['--max-score', '25']).code, 0);
});

test('--json prints parseable JSON', () => {
  const parsed = JSON.parse(run(makeDirtyBranch(), ['--json']).stdout);
  assert.equal(parsed.score, 25);
  assert.equal(parsed.findings[0].rule, 'empty-catch');
});

test('--badge prints only the badge', () => {
  assert.equal(
    run(makeDirtyBranch(), ['--badge']).stdout,
    '[![slop score](https://img.shields.io/badge/slop_score-25-yellow)](https://github.com/tisankanj/slop-check)\n',
  );
});

test('NO_COLOR and --no-color turn colour off', () => {
  assert.ok(!run(makeDirtyBranch(), [], { NO_COLOR: '1' }).stdout.includes('\x1b['));
  assert.ok(!run(makeDirtyBranch(), ['--no-color']).stdout.includes('\x1b['));
});

test('outside a git repo it exits 2 with one line', () => {
  const dir = mkdtempSync(join(tmpdir(), 'slop-check-cli-'));
  const { code, stderr } = run(dir, []);
  assert.equal(code, 2);
  assert.equal(stderr, 'slop-check: not inside a git repository\n');
});

test('an unknown flag exits 2', () => {
  const { code, stderr } = run(tmpdir(), ['--nope']);
  assert.equal(code, 2);
  assert.match(stderr, /^slop-check: /);
});

test('--staged and --all together exit 2', () => {
  assert.equal(run(makeDirtyBranch(), ['--staged', '--all']).code, 2);
});

test('maxScore from config is used and the flag wins', () => {
  const dir = makeDirtyBranch();
  writeFileSync(join(dir, '.slopcheckrc.json'), '{ "maxScore": 10 }');
  assert.equal(run(dir, []).code, 1);
  assert.equal(run(dir, ['--max-score', '50']).code, 0);
});

test('config warnings go to stderr', () => {
  const dir = makeDirtyBranch();
  writeFileSync(join(dir, '.slopcheckrc.json'), '{ "rules": { "nope": "off" } }');
  const { stderr, code } = run(dir, []);
  assert.equal(code, 0);
  assert.match(stderr, /slop-check: warning: unknown rule "nope"/);
});
