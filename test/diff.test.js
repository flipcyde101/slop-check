import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDiff } from '../src/diff.js';

function fileDiff(path, hunks) {
  return [
    `diff --git a/${path} b/${path}`,
    'index 1111111..2222222 100644',
    `--- a/${path}`,
    `+++ b/${path}`,
    ...hunks,
  ].join('\n');
}

test('parses added lines with new line numbers', () => {
  const text = fileDiff('src/a.js', ['@@ -1,0 +5,2 @@', '+a', '+b']);
  assert.deepEqual(parseDiff(text), [
    { path: 'src/a.js', lines: [{ number: 5, text: 'a' }, { number: 6, text: 'b' }] },
  ]);
});

test('ignores removed and context lines', () => {
  const text = fileDiff('a.js', ['@@ -1,3 +1,3 @@', ' keep', '-old', '+new', ' keep']);
  assert.deepEqual(parseDiff(text), [{ path: 'a.js', lines: [{ number: 2, text: 'new' }] }]);
});

test('handles several hunks and files', () => {
  const text = [
    fileDiff('a.js', ['@@ -1,0 +1 @@', '+one', '@@ -10,0 +20,1 @@', '+twenty']),
    fileDiff('b.py', ['@@ -0,0 +1,1 @@', '+x = 1']),
  ].join('\n');
  assert.deepEqual(parseDiff(text), [
    { path: 'a.js', lines: [{ number: 1, text: 'one' }, { number: 20, text: 'twenty' }] },
    { path: 'b.py', lines: [{ number: 1, text: 'x = 1' }] },
  ]);
});

test('keeps paths with spaces and non-ASCII', () => {
  const text = [
    fileDiff('my file.js', ['@@ -0,0 +1 @@', '+a']),
    fileDiff('café.js', ['@@ -0,0 +1 @@', '+b']),
  ].join('\n');
  assert.deepEqual(parseDiff(text).map((f) => f.path), ['my file.js', 'café.js']);
});

test('skips deleted files', () => {
  const text = [
    'diff --git a/gone.js b/gone.js',
    'deleted file mode 100644',
    '--- a/gone.js',
    '+++ /dev/null',
    '@@ -1,2 +0,0 @@',
    '-a',
    '-b',
  ].join('\n');
  assert.deepEqual(parseDiff(text), []);
});

test('skips binary files', () => {
  const text = [
    'diff --git a/x.png b/x.png',
    'index 1111111..2222222 100644',
    'Binary files a/x.png and b/x.png differ',
  ].join('\n');
  assert.deepEqual(parseDiff(text), []);
});

test('strips carriage returns', () => {
  const text = fileDiff('a.js', ['@@ -0,0 +1 @@', '+a\r']);
  assert.equal(parseDiff(text)[0].lines[0].text, 'a');
});

test('does not treat a "+++" content line inside a hunk as a header', () => {
  const text = fileDiff('a.js', ['@@ -0,0 +1,2 @@', '+++counter;', '+done']);
  assert.deepEqual(parseDiff(text), [
    { path: 'a.js', lines: [{ number: 1, text: '++counter;' }, { number: 2, text: 'done' }] },
  ]);
});
