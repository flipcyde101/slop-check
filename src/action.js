// GitHub Action entry: runs the check on a pull request, writes the job summary,
// and keeps one PR comment up to date with the score.

import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { SlopCheckError } from './git.js';
import { formatText } from './report.js';
import { runCheck } from './run.js';
import { badgeMarkdown } from './score.js';

const MARKER = '<!-- slop-check -->';
const ZERO_SHA = '0'.repeat(40);
// GitHub rejects comments over 65536 characters.
const MAX_REPORT_LENGTH = 60000;

function readInputs(env) {
  const maxScoreText = (env['INPUT_MAX-SCORE'] || '').trim();
  return {
    maxScore: maxScoreText === '' ? null : Number(maxScoreText),
    comment: (env.INPUT_COMMENT || 'true').trim() !== 'false',
    token: env['INPUT_GITHUB-TOKEN'] || '',
  };
}

function readEvent(env) {
  if (!env.GITHUB_EVENT_PATH) {
    return {};
  }
  return JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
}

function pickBaseSha(eventName, event) {
  if (event.pull_request) {
    return event.pull_request.base.sha;
  }
  if (eventName === 'push' && event.before && event.before !== ZERO_SHA) {
    return event.before;
  }
  return undefined;
}

function buildReport(result) {
  let text = formatText(result, { color: false });
  if (text.length > MAX_REPORT_LENGTH) {
    text = `${text.slice(0, MAX_REPORT_LENGTH)}\n... report cut short, run slop-check locally for the rest.\n`;
  }
  return [
    MARKER,
    `### Slop score: ${result.score}/100 (${result.label})`,
    '',
    '```text',
    text.trimEnd(),
    '```',
    '',
    badgeMarkdown(result.score, result.color),
    '',
  ].join('\n');
}

async function upsertComment(env, inputs, prNumber, body, fetchFn) {
  const api = `${env.GITHUB_API_URL || 'https://api.github.com'}/repos/${env.GITHUB_REPOSITORY}`;
  const headers = {
    Authorization: `Bearer ${inputs.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'slop-check',
  };

  const list = await fetchFn(`${api}/issues/${prNumber}/comments?per_page=100`, { headers });
  if (!list.ok) {
    return list.status;
  }
  const comments = await list.json();
  const existing = comments.find((comment) => typeof comment.body === 'string' && comment.body.startsWith(MARKER));

  const request = existing
    ? { url: `${api}/issues/comments/${existing.id}`, method: 'PATCH' }
    : { url: `${api}/issues/${prNumber}/comments`, method: 'POST' };
  const response = await fetchFn(request.url, { method: request.method, headers, body: JSON.stringify({ body }) });
  return response.ok ? null : response.status;
}

export async function runAction({ env, fetchFn, cwd }) {
  const inputs = readInputs(env);
  const event = readEvent(env);

  let result;
  try {
    const validMaxScore = Number.isInteger(inputs.maxScore) && inputs.maxScore >= 0 && inputs.maxScore <= 100;
    if (inputs.maxScore !== null && !validMaxScore) {
      throw new SlopCheckError('max-score must be a whole number from 0 to 100');
    }
    result = runCheck({ cwd, mode: 'branch', baseSha: pickBaseSha(env.GITHUB_EVENT_NAME, event) });
  } catch (error) {
    if (!(error instanceof SlopCheckError)) {
      throw error;
    }
    process.stdout.write(`::error::slop-check: ${error.message}\n`);
    return { score: null, failed: true };
  }

  process.stdout.write(formatText(result, { color: false }));
  const report = buildReport(result);
  if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(env.GITHUB_STEP_SUMMARY, report);
  }
  if (env.GITHUB_OUTPUT) {
    appendFileSync(env.GITHUB_OUTPUT, `score=${result.score}\n`);
  }

  const prNumber = event.pull_request ? event.pull_request.number : null;
  if (inputs.comment && prNumber && inputs.token) {
    let failedStatus;
    try {
      failedStatus = await upsertComment(env, inputs, prNumber, report, fetchFn);
    } catch (error) {
      failedStatus = error.message;
    }
    // Fork PRs get a read-only token. The job summary still has the full report.
    if (failedStatus) {
      process.stdout.write(`::warning::slop-check could not post the PR comment (${failedStatus}). The job summary has the report.\n`);
    }
  }

  const failed = inputs.maxScore !== null && result.score > inputs.maxScore;
  if (failed) {
    process.stdout.write(`::error::Slop score ${result.score} is above max-score ${inputs.maxScore}.\n`);
  }
  return { score: result.score, failed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cwd = process.env.GITHUB_WORKSPACE || process.cwd();
  runAction({ env: process.env, fetchFn: fetch, cwd }).then((outcome) => {
    if (outcome.failed) {
      process.exitCode = 1;
    }
  });
}
