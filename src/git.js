// Everything slop-check asks git: where the repo is, what the base is, what changed.

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BASE_CANDIDATES = ['origin/main', 'origin/master', 'main', 'master'];
const MAX_FILE_BYTES = 1024 * 1024;

// The exact diff format slop-check parses, whatever the user's git config says.
const DIFF_OPTIONS = ['--unified=0', '--no-color', '--no-ext-diff', '--no-textconv', '--src-prefix=a/', '--dst-prefix=b/'];

export class SlopCheckError extends Error {}

export function git(args, cwd) {
  try {
    return execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch (error) {
    const stderr = String(error.stderr || error.message);
    if (stderr.includes('not a git repository')) {
      throw new SlopCheckError('not inside a git repository');
    }
    throw new SlopCheckError(`git ${args[0]} failed: ${stderr.trim().split('\n')[0]}`);
  }
}

function refExists(cwd, ref) {
  try {
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], cwd);
    return true;
  } catch {
    // rev-parse exits non-zero for a missing ref; that is the answer, not an error.
    return false;
  }
}

export function findRepoRoot(cwd) {
  const root = git(['rev-parse', '--show-toplevel'], cwd).trim();
  if (!refExists(root, 'HEAD')) {
    throw new SlopCheckError('this repository has no commits yet');
  }
  return root;
}

function defaultBaseRef(cwd) {
  try {
    const originHead = git(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD'], cwd).trim();
    return originHead.replace('refs/remotes/', '');
  } catch {
    // No origin/HEAD is normal for local-only repos; fall through to the usual names.
  }
  for (const candidate of BASE_CANDIDATES) {
    if (refExists(cwd, candidate)) {
      return candidate;
    }
  }
  return null;
}

// Returns { sha, name } for the merge base, or null when HEAD is the base itself.
export function findBase(cwd, ref) {
  const name = ref || defaultBaseRef(cwd);
  if (!name) {
    return null;
  }
  if (!refExists(cwd, name)) {
    throw new SlopCheckError(`unknown base "${name}"`);
  }
  const sha = git(['merge-base', 'HEAD', name], cwd).trim();
  const head = git(['rev-parse', 'HEAD'], cwd).trim();
  if (sha === head) {
    return null;
  }
  return { sha, name };
}

export function findBaseFromSha(cwd, baseSha) {
  if (!refExists(cwd, baseSha)) {
    throw new SlopCheckError(
      `base commit ${baseSha.slice(0, 7)} is not in this clone. Use actions/checkout with fetch-depth: 0.`,
    );
  }
  const sha = git(['merge-base', 'HEAD', baseSha], cwd).trim();
  return { sha, name: baseSha.slice(0, 7) };
}

export function getDiffText(cwd, options) {
  if (options.mode === 'staged') {
    return git(['diff', '--cached', ...DIFF_OPTIONS], cwd);
  }
  return git(['diff', options.base || 'HEAD', ...DIFF_OPTIONS], cwd);
}

export function getCommits(cwd, base) {
  if (!base) {
    return [];
  }
  const output = git(['log', '--no-merges', '--format=%H%x00%B%x1e', `${base}..HEAD`], cwd);
  const commits = [];
  for (const entry of output.split('\x1e')) {
    const [sha, message] = entry.trim().split('\x00');
    if (sha) {
      commits.push({ sha, message: (message || '').trim() });
    }
  }
  return commits;
}

function isBinary(buffer) {
  return buffer.subarray(0, 8000).includes(0);
}

// Reads tracked files from disk as if every line were added. `keep` filters paths first.
export function getAllFiles(cwd, keep) {
  const paths = git(['ls-files', '-z'], cwd).split('\0').filter(Boolean);
  const files = [];
  for (const path of paths) {
    if (!keep(path)) {
      continue;
    }
    const fullPath = join(cwd, path);
    let size;
    try {
      size = statSync(fullPath).size;
    } catch {
      // Tracked but deleted in the working tree: nothing to read.
      continue;
    }
    if (size > MAX_FILE_BYTES) {
      continue;
    }
    const buffer = readFileSync(fullPath);
    if (isBinary(buffer)) {
      continue;
    }
    const lines = buffer.toString('utf8').split('\n').map((text, index) => ({ number: index + 1, text: text.replace(/\r$/, '') }));
    files.push({ path, lines });
  }
  return files;
}
