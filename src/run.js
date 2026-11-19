// The whole check in one call. The CLI and the GitHub Action both start here.

import { checkCommit, checkFile, MAX_LINE_LENGTH } from './check.js';
import { enabledRules, isIgnored, loadConfig } from './config.js';
import { parseDiff } from './diff.js';
import { findBase, findBaseFromSha, findRepoRoot, getAllFiles, getCommits, getDiffText } from './git.js';
import { getLanguage } from './languages.js';
import { scoreFindings } from './score.js';

function countScannedLines(files) {
  let count = 0;
  for (const file of files) {
    for (const line of file.lines) {
      if (line.text.trim() !== '' && line.text.length <= MAX_LINE_LENGTH) {
        count += 1;
      }
    }
  }
  return count;
}

export function runCheck(options) {
  const root = findRepoRoot(options.cwd);
  const config = options.config || loadConfig(root);
  const enabled = enabledRules(config);
  const isChecked = (path) => !isIgnored(path, config) && getLanguage(path) !== null;

  let base = null;
  let files;
  let commits = [];

  if (options.mode === 'all') {
    files = getAllFiles(root, isChecked);
  } else if (options.mode === 'staged') {
    files = parseDiff(getDiffText(root, { mode: 'staged' })).filter((file) => isChecked(file.path));
  } else {
    base = options.baseSha ? findBaseFromSha(root, options.baseSha) : findBase(root, options.ref);
    const diffText = getDiffText(root, { mode: 'branch', base: base ? base.sha : null });
    files = parseDiff(diffText).filter((file) => isChecked(file.path));
    commits = base ? getCommits(root, base.sha) : [];
  }

  const findings = [];
  for (const file of files) {
    findings.push(...checkFile(file, enabled));
  }
  for (const commit of commits) {
    findings.push(...checkCommit(commit, enabled));
  }

  const addedLines = countScannedLines(files);
  const score = scoreFindings(findings, addedLines);
  return {
    base: base ? base.name : null,
    mode: options.mode,
    files: files.length,
    addedLines,
    findings,
    score: score.score,
    label: score.label,
    color: score.color,
  };
}
