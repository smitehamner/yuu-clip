// Feature-map - Typed SSE job-event decoder: the browser half of the versioned
//   server->browser event protocol. decodeEvent() turns one already-JSON-parsed SSE
//   payload into a discriminated {kind, ...} object, implementing the SAME rules as
//   yuu_clip/web/jobevents.py::parse_event and verified against the SAME decode_fixtures
//   table (shared/job-events.json). _openSSE (core/jobs.js) is the only caller.
//   isDoneSentinel/doneError are the legacy __DONE__ helpers, kept here (their single
//   home) and re-exported by jobs.js during the migration for the two hand-rolled
//   readers (settings-installs.js / modelcatalog.js).
//   Source of truth: yuu_clip/web/jobevents.py · Tests: tests/js/core/jobevents.test.js
import contract from '../shared/job-events.json';

const KNOWN_TYPES = new Set(contract.event_types);
const PROTOCOL_VERSION = contract.protocol_version;
const _DONE_SENTINEL = '__DONE__';

function _decodeString(payload) {
  if (payload === _DONE_SENTINEL) return { kind: 'legacy-done', payload, error: null };
  return { kind: 'legacy-line', payload };
}

function _decodeTyped(payload) {
  switch (payload.type) {
    case 'log':
      return { kind: 'log', text: payload.text ?? '', level: payload.level ?? 'info' };
    case 'progress':
      return {
        kind: 'progress',
        stage: payload.stage ?? null,
        done: payload.done ?? null,
        total: payload.total ?? null,
        label: payload.label ?? null,
      };
    case 'result':
      return { kind: 'result', data: payload.data ?? null };
    case 'done':
      return { kind: 'done', outcome: payload.outcome ?? null, error: payload.error ?? '' };
    default:
      return { kind: 'unknown' };
  }
}

function _decodeObject(payload) {
  if (payload.type === _DONE_SENTINEL) {
    const error = payload.ok === false ? (payload.error ?? null) : null;
    return { kind: 'legacy-done', payload, error };
  }
  const version = payload.v;
  if (version === PROTOCOL_VERSION) {
    if (!KNOWN_TYPES.has(payload.type)) return { kind: 'unknown' };
    return _decodeTyped(payload);
  }
  if (typeof version === 'number' && version > PROTOCOL_VERSION) return { kind: 'newer-protocol' };
  return { kind: 'legacy-line', payload };
}

// Decode one already-JSON-parsed SSE payload into a discriminated result. Mirrors
// parse_event in jobevents.py (same decode_fixtures). Section-2 consumer rules: a bare
// string is a legacy prose line (or the bare "__DONE__" done sentinel); a "__DONE__"
// object is a legacy done; a v1 object with a known type is typed; a v1 object with an
// unknown type is ignored; a v>1 object is a newer-protocol frame.
function decodeEvent(payload) {
  if (typeof payload === 'string') return _decodeString(payload);
  if (payload !== null && typeof payload === 'object' && !Array.isArray(payload)) {
    return _decodeObject(payload);
  }
  return { kind: 'legacy-line', payload };
}

// ── legacy __DONE__ sentinel helpers (migration-only) ─────────────────────────
// The pre-protocol terminal payload has two forms (web/sse.py::_done_event): the bare
// string "__DONE__" for success, and {type:'__DONE__', ok:false, error} for failure.
// Every hand-rolled reader must understand BOTH - one that only tests the string reports
// a failed job as complete and logs the object as "[object Object]". Kept verbatim here
// (their single home) and re-exported by jobs.js for settings-installs.js/modelcatalog.js
// until those readers move onto decodeEvent in a later migration stage.
function isDoneSentinel(msg) {
  return msg === '__DONE__' || (!!msg && typeof msg === 'object' && msg.type === '__DONE__');
}

// The failure message for a done sentinel, or null when it signals success. Falls back
// to a plain-language message when an ok:false sentinel carries no error text.
function doneError(msg) {
  if (!msg || typeof msg !== 'object' || msg.ok !== false) return null;
  return msg.error || 'The job did not finish - check the log for details.';
}

export { decodeEvent, isDoneSentinel, doneError };
