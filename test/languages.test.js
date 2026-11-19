import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLanguage, isTestFile, isExampleFile } from '../src/languages.js';

test('getLanguage knows slash-comment languages', () => {
  for (const path of ['a.ts', 'src/a.go', 'lib/a.dart', 'A.Java']) {
    assert.deepEqual(getLanguage(path), { style: 'slash' }, path);
  }
});

test('getLanguage knows hash-comment languages and Dockerfiles', () => {
  for (const path of ['a.py', '.github/ci.yml', 'Dockerfile', 'deploy/api.dockerfile']) {
    assert.deepEqual(getLanguage(path), { style: 'hash' }, path);
  }
});

test('getLanguage knows dash-comment and text files', () => {
  assert.deepEqual(getLanguage('db/q.sql'), { style: 'dash' });
  assert.deepEqual(getLanguage('README.md'), { style: 'text' });
});

test('getLanguage returns null for unknown files', () => {
  assert.equal(getLanguage('a.xyz'), null);
  assert.equal(getLanguage('Makefile'), null);
});

test('isTestFile', () => {
  for (const path of ['a.test.js', 'src/a.spec.ts', '__tests__/a.js', 'test/a.js', 'pkg/tests/a.py']) {
    assert.equal(isTestFile(path), true, path);
  }
  assert.equal(isTestFile('src/latest.js'), false);
  assert.equal(isTestFile('src/contest/a.js'), false);
});

test('isExampleFile', () => {
  assert.equal(isExampleFile('.env.example'), true);
  assert.equal(isExampleFile('config/app.sample.json'), true);
  assert.equal(isExampleFile('src/examples.js'), false);
});

test('isTestFile knows Go, Python and Ruby test layouts', () => {
  for (const path of ['pkg/user_test.go', 'tests_x/test_user.py', 'app/user_test.py', 'spec/user_spec.rb', 'lib/user_spec.rb']) {
    assert.equal(isTestFile(path), true, path);
  }
  assert.equal(isTestFile('src/contest.py'), false);
});
