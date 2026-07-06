'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mimeTypeFor, isPathInside, parseRange, rangeResponseInit } = require('../media-serve');

test('parseRange handles a start-end range', () => {
  assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 });
});

test('parseRange handles an open-ended range', () => {
  assert.deepEqual(parseRange('bytes=100-', 1000), { start: 100, end: 999 });
});

test('parseRange handles a suffix range', () => {
  assert.deepEqual(parseRange('bytes=-500', 1000), { start: 500, end: 999 });
});

test('parseRange rejects malformed ranges', () => {
  assert.equal(parseRange('bytes=abc', 1000), null);
  assert.equal(parseRange('bytes=', 1000), null);
  assert.equal(parseRange('', 1000), null);
});

test('parseRange rejects start greater than end', () => {
  assert.equal(parseRange('bytes=500-100', 1000), null);
});

test('parseRange rejects end at or beyond file size', () => {
  assert.equal(parseRange('bytes=0-999', 999), null);
  assert.equal(parseRange('bytes=0-1000', 1000), null);
});

test('parseRange rejects a negative start', () => {
  assert.equal(parseRange('bytes=-1-100', 1000), null);
});

test('parseRange rejects multi-range headers', () => {
  assert.equal(parseRange('bytes=0-1,2-3', 1000), null);
});

test('isPathInside accepts a nested path', () => {
  assert.equal(isPathInside('/a/root/child.mp4', '/a/root'), true);
});

test('isPathInside accepts the root itself', () => {
  assert.equal(isPathInside('/a/root', '/a/root'), true);
});

test('isPathInside rejects a parent-directory escape', () => {
  assert.equal(isPathInside('/a/other.mp4', '/a/root'), false);
});

test('isPathInside rejects a sibling with a prefix-matching name', () => {
  assert.equal(isPathInside('/a/rootish/child.mp4', '/a/root'), false);
});

test('mimeTypeFor maps known extensions', () => {
  assert.equal(mimeTypeFor('.mp4'), 'video/mp4');
  assert.equal(mimeTypeFor('.webm'), 'video/webm');
});

test('mimeTypeFor is case-insensitive', () => {
  assert.equal(mimeTypeFor('.MP4'), 'video/mp4');
});

test('mimeTypeFor falls back to octet-stream for unknown extensions', () => {
  assert.equal(mimeTypeFor('.xyz'), 'application/octet-stream');
});

test('rangeResponseInit with no range returns 200 and full-length headers', () => {
  const init = rangeResponseInit(null, 1000, 'video/mp4');
  assert.equal(init.status, 200);
  assert.deepEqual(init.headers, {
    'Content-Type': 'video/mp4', 'Content-Length': '1000', 'Accept-Ranges': 'bytes',
  });
  assert.equal(init.range, null);
});

test('rangeResponseInit with a valid range returns 206 and Content-Range', () => {
  const init = rangeResponseInit('bytes=0-99', 1000, 'video/mp4');
  assert.equal(init.status, 206);
  assert.deepEqual(init.headers, {
    'Content-Type': 'video/mp4', 'Content-Length': '100',
    'Content-Range': 'bytes 0-99/1000', 'Accept-Ranges': 'bytes',
  });
  assert.deepEqual(init.range, { start: 0, end: 99 });
});

test('rangeResponseInit with an unparseable range returns 416', () => {
  const init = rangeResponseInit('bytes=abc', 1000, 'video/mp4');
  assert.equal(init.status, 416);
  assert.deepEqual(init.headers, { 'Content-Range': 'bytes */1000' });
  assert.equal(init.range, null);
});
