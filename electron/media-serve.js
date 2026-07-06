'use strict';

// Pure decision logic backing the `yuu-media://` protocol handler, split out of
// main.js so the path-containment / range-parsing logic (a path-traversal risk
// if it regresses) can be unit-tested without Electron, fs, or a Response.
// main.js supplies real fs stats and builds the streamed Response around
// rangeResponseInit()'s plain descriptor.

const path = require('path');

const MEDIA_MIME_TYPES = {
  '.mp4':  'video/mp4',
  '.m4v':  'video/mp4',
  '.mkv':  'video/x-matroska',
  '.mov':  'video/quicktime',
  '.avi':  'video/x-msvideo',
  '.webm': 'video/webm',
};

function mimeTypeFor(ext) {
  return MEDIA_MIME_TYPES[(ext || '').toLowerCase()] || 'application/octet-stream';
}

function isPathInside(candidate, root) {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// Parses a single "bytes=start-end" Range header (the only form <video> emits)
// and returns the serviceable [start, end] pair, or null if malformed/out of range.
function parseRange(rangeHeader, fileSize) {
  const match = /^bytes=(\d*)-(\d*)$/.exec((rangeHeader || '').trim());
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? parseInt(match[1], 10) : fileSize - parseInt(match[2], 10);
  const end   = match[1] && match[2] ? parseInt(match[2], 10) : fileSize - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || start > end || end >= fileSize) return null;
  return { start, end };
}

// The pure status/headers decision behind serveFileWithRange — no fs, no
// Response, so it stays testable without spinning up real files or streams.
function rangeResponseInit(rangeHeader, fileSize, mimeType) {
  if (!rangeHeader) {
    return {
      status: 200,
      headers: { 'Content-Type': mimeType, 'Content-Length': String(fileSize), 'Accept-Ranges': 'bytes' },
      range: null,
    };
  }

  const range = parseRange(rangeHeader, fileSize);
  if (!range) {
    return { status: 416, headers: { 'Content-Range': `bytes */${fileSize}` }, range: null };
  }

  return {
    status: 206,
    headers: {
      'Content-Type':   mimeType,
      'Content-Length': String(range.end - range.start + 1),
      'Content-Range':  `bytes ${range.start}-${range.end}/${fileSize}`,
      'Accept-Ranges':  'bytes',
    },
    range,
  };
}

module.exports = { mimeTypeFor, isPathInside, parseRange, rangeResponseInit };
