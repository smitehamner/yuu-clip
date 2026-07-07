'use strict';

// Pure helpers for the first-run wizard's "Restore from a backup" path. main.js
// spawns the Python restore CLI (yuu_clip.cli restore) with these args and maps
// its exit code; keeping the arg/exit logic here makes it unit-testable without
// spawning Electron. See yuu_clip/cli/restore.py for the matching exit codes.

// yuu_clip.cli restore exits 2 when the target folder already holds a project and
// --overwrite wasn't passed, so the wizard can offer "replace it?" rather than
// failing outright.
const RESTORE_EXIT_PROJECT_EXISTS = 2;

function buildRestoreArgs(archive, project, overwrite) {
  const args = ['-m', 'yuu_clip.cli', 'restore', '--archive', archive, '--project', project];
  if (overwrite) args.push('--overwrite');
  return args;
}

function parseRestoreExit(code, stderr) {
  if (code === 0) return { ok: true };
  if (code === RESTORE_EXIT_PROJECT_EXISTS) return { ok: false, code: 'project_exists' };
  return { ok: false, error: (stderr || '').trim() || `Restore failed (exit code ${code})` };
}

module.exports = { buildRestoreArgs, parseRestoreExit, RESTORE_EXIT_PROJECT_EXISTS };
