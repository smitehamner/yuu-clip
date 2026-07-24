// Feature-map - Typed SSE job-event decoder: the browser half of the versioned
//   server->browser event protocol. decodeEvent() turns one already-JSON-parsed SSE
//   payload into a discriminated {kind, ...} object, implementing the SAME rules as
//   yuu_clip/web/jobevents.py::parse_event and verified against the SAME decode_fixtures
//   table (shared/job-events.json). _openSSE (core/jobs.js) is the primary caller; the
//   two hand-rolled stream readers (settings-installs.js / modelcatalog.js) also call it
//   directly. The legacy done-sentinel / prose-string decode paths were retired in
//   migration stage 4 now that every emitter speaks the typed wire.
//   Source of truth: yuu_clip/web/jobevents.py · Tests: tests/js/core/jobevents.test.js
import contract from '../shared/job-events.json';

const KNOWN_TYPES = new Set(contract.event_types);
const PROTOCOL_VERSION = contract.protocol_version;

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
  const version = payload.v;
  if (version === PROTOCOL_VERSION) {
    if (!KNOWN_TYPES.has(payload.type)) return { kind: 'unknown' };
    return _decodeTyped(payload);
  }
  if (typeof version === 'number' && version > PROTOCOL_VERSION) return { kind: 'newer-protocol' };
  return { kind: 'unknown' };
}

// Decode one already-JSON-parsed SSE payload into a discriminated result. Mirrors
// parse_event in jobevents.py (same decode_fixtures). Section-2 consumer rules: a v1
// object with a known type is typed; a v1 object with an unknown type is ignored; a v>1
// object is a newer-protocol frame; anything else (a non-object, or a dict with no v1
// envelope) is unknown - the legacy prose-string / done-sentinel paths were retired.
function decodeEvent(payload) {
  if (payload !== null && typeof payload === 'object' && !Array.isArray(payload)) {
    return _decodeObject(payload);
  }
  return { kind: 'unknown' };
}

export { decodeEvent };
