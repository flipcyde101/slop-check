#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { enabledRules, loadConfig } from '../src/config.js';
import { findRepoRoot, SlopCheckError } from '../src/git.js';
import { formatJson, formatText } from '../src/report.js';
import { RULES } from '../src/rules.js';
import { runCheck } from '../src/run.js';
import { badgeMarkdown } from '../src/score.js';

const HELP = `Usage: slop-check [base] [options]

Checks the lines your branch added for leftovers of unreviewed AI output.

  slop-check               check the current branch against main
  slop-check <base>        check the current branch against <base>

Options:
  --staged                 check staged changes only
  --all                    check every tracked file
  --json                   print JSON instead of text
  --badge                  print a README badge for this score
  --max-score <n>          exit 1 if the score is above n
  --list-rules             print every rule with its weight and status
  --no-color               plain output (NO_COLOR is also respected)
  -h, --help               show this help
  -v, --version            show the version
`;

const OPTIONS = {
  staged: { type: 'boolean' },
  all: { type: 'boolean' },
  json: { type: 'boolean' },
  badge: { type: 'boolean' },
  'max-score': { type: 'string' },
  'list-rules': { type: 'boolean' },
  'no-color': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
};

function weightName(weight) {
  if (weight >= 5) {
    return 'high';
  }
  return weight >= 3 ? 'medium' : 'low';
}

function readVersion() {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  return packageJson.version;
}

// Outside a repo there is no config file, but --list-rules should still work.
function loadConfigIfInRepo() {
  try {
    return loadConfig(findRepoRoot(process.cwd()));
  } catch {
    return loadConfig(process.cwd());
  }
}

function listRules() {
  const enabled = enabledRules(loadConfigIfInRepo());
  const rows = [];
  for (const rule of RULES) {
    const status = enabled.has(rule.id) ? 'on' : 'off';
    rows.push(`${rule.id.padEnd(24)}${weightName(rule.weight).padEnd(8)}${status.padEnd(5)}${rule.message}`);
  }
  return `${rows.join('\n')}\n`;
}

function parseMaxScore(value) {
  if (value === undefined) {
    return null;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 100) {
    throw new SlopCheckError('--max-score must be a whole number from 0 to 100');
  }
  return number;
}

function main() {
  let parsed;
  try {
    parsed = parseArgs({ options: OPTIONS, allowPositionals: true, strict: true });
  } catch (error) {
    throw new SlopCheckError(`${error.message}. Run slop-check --help.`);
  }
  const flags = parsed.values;

  if (flags.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (flags.version) {
    process.stdout.write(`${readVersion()}\n`);
    return 0;
  }
  if (flags['list-rules']) {
    process.stdout.write(listRules());
    return 0;
  }
  if (flags.staged && flags.all) {
    throw new SlopCheckError('use --staged or --all, not both');
  }
  if (parsed.positionals.length > 1) {
    throw new SlopCheckError('give at most one base. Run slop-check --help.');
  }

  const flagMaxScore = parseMaxScore(flags['max-score']);
  const config = loadConfig(findRepoRoot(process.cwd()));
  for (const warning of config.warnings) {
    process.stderr.write(`slop-check: warning: ${warning}\n`);
  }

  let mode = 'branch';
  if (flags.staged) {
    mode = 'staged';
  } else if (flags.all) {
    mode = 'all';
  }
  const result = runCheck({ cwd: process.cwd(), mode, ref: parsed.positionals[0], config });

  if (flags.json) {
    process.stdout.write(formatJson(result));
  } else if (flags.badge) {
    process.stdout.write(`${badgeMarkdown(result.score, result.color)}\n`);
  } else {
    const color = Boolean(process.stdout.isTTY) && !flags['no-color'] && !process.env.NO_COLOR;
    process.stdout.write(formatText(result, { color }));
  }

  const maxScore = flagMaxScore === null ? config.maxScore : flagMaxScore;
  return maxScore !== null && result.score > maxScore ? 1 : 0;
}

try {
  process.exitCode = main();
} catch (error) {
  if (!(error instanceof SlopCheckError)) {
    throw error;
  }
  process.stderr.write(`slop-check: ${error.message}\n`);
  process.exitCode = 2;
}
