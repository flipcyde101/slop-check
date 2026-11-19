import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { matchGlob, loadConfig, enabledRules, isIgnored } from '../src/config.js';

function dirWithConfig(content) {
  const dir = mkdtempSync(join(tmpdir(), 'slop-check-config-'));
  if (content !== undefined) {
    writeFileSync(join(dir, '.slopcheckrc.json'), content);
  }
  return dir;
}

test('matchGlob handles ** * and ?', () => {
  assert.equal(matchGlob('docs/legacy/**', 'docs/legacy/a/b.md'), true);
  assert.equal(matchGlob('**/*.generated.ts', 'src/x.generated.ts'), true);
  assert.equal(matchGlob('src/?.js', 'src/a.js'), true);
  assert.equal(matchGlob('src/?.js', 'src/ab.js'), false);
  assert.equal(matchGlob('dist/**', 'src/dist.js'), false);
});

test('a pattern without a slash matches the file name at any depth', () => {
  assert.equal(matchGlob('*.lock', 'deep/Cargo.lock'), true);
  assert.equal(matchGlob('*.lock', 'lockfile.js'), false);
});

test('dots and other characters are literal', () => {
  assert.equal(matchGlob('a.js', 'abjs'), false);
  assert.equal(matchGlob('a+b.js', 'a+b.js'), true);
});

test('no config file gives defaults', () => {
  const config = loadConfig(dirWithConfig());
  assert.deepEqual(config, { rules: {}, ignore: [], maxScore: null, warnings: [] });
  assert.ok(enabledRules(config).has('em-dash'));
  assert.ok(!enabledRules(config).has('ai-attribution'));
});

test('config turns rules on and off and warns about unknown ones', () => {
  const config = loadConfig(dirWithConfig('{ "rules": { "em-dash": "off", "ai-attribution": "on", "nope": "off" } }'));
  const enabled = enabledRules(config);
  assert.ok(!enabled.has('em-dash'));
  assert.ok(enabled.has('ai-attribution'));
  assert.equal(config.warnings.length, 1);
  assert.match(config.warnings[0], /unknown rule "nope"/);
});

test('config reads ignore and maxScore', () => {
  const config = loadConfig(dirWithConfig('{ "ignore": ["docs/**"], "maxScore": 30 }'));
  assert.deepEqual(config.ignore, ['docs/**']);
  assert.equal(config.maxScore, 30);
  assert.equal(isIgnored('docs/a.md', config), true);
});

test('invalid JSON gives a warning instead of throwing', () => {
  const config = loadConfig(dirWithConfig('{ nope'));
  assert.equal(config.warnings.length, 1);
  assert.match(config.warnings[0], /\.slopcheckrc\.json/);
  assert.deepEqual(config.rules, {});
});

test('wrong value types give warnings', () => {
  const config = loadConfig(dirWithConfig('{ "rules": { "em-dash": "maybe" }, "ignore": "docs", "maxScore": "high" }'));
  assert.equal(config.warnings.length, 3);
  assert.deepEqual(config.ignore, []);
  assert.equal(config.maxScore, null);
});

test('default ignores cover dependencies, builds and lockfiles', () => {
  const config = loadConfig(dirWithConfig());
  for (const path of ['node_modules/a.js', 'packages/x/node_modules/a.js', 'dist/a.js', 'package-lock.json', 'a/yarn.lock', 'app.min.js', 'a.js.map', 'vendor/x.go']) {
    assert.equal(isIgnored(path, config), true, path);
  }
  assert.equal(isIgnored('src/distance.js', config), false);
});
