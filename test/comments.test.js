import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getComment } from '../src/comments.js';

test('finds a slash comment at the start of a line', () => {
  assert.equal(getComment('// hi', 'slash'), 'hi');
  assert.equal(getComment('    //hi there', 'slash'), 'hi there');
});

test('finds a slash comment after code', () => {
  assert.equal(getComment('x = 1; // hi', 'slash'), 'hi');
});

test('ignores // inside a string', () => {
  assert.equal(getComment('url = "https://a.io"', 'slash'), null);
  assert.equal(getComment("fetch('http://x.io/a') // load", 'slash'), 'load');
});

test('finds block comment lines', () => {
  assert.equal(getComment(' * hi', 'slash'), 'hi');
  assert.equal(getComment('/* hi */', 'slash'), 'hi');
  assert.equal(getComment('/** hi', 'slash'), 'hi');
});

test('finds hash comments and ignores # inside strings', () => {
  assert.equal(getComment('# hi', 'hash'), 'hi');
  assert.equal(getComment('x = 1  # hi', 'hash'), 'hi');
  assert.equal(getComment('color: "#fff"', 'hash'), null);
  assert.equal(getComment('#!/usr/bin/env python', 'hash'), null);
});

test('finds dash comments', () => {
  assert.equal(getComment('-- hi', 'dash'), 'hi');
});

test('returns null when there is no comment', () => {
  assert.equal(getComment('const a = b - c;', 'slash'), null);
  assert.equal(getComment('a = b', 'hash'), null);
});
