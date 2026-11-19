// Prints a result as text for people or as JSON for scripts.

const RULE_COLUMN = 24;
const COLORS = { bold: 1, dim: 2, red: 31, green: 32, yellow: 33 };
const SCORE_COLORS = { brightgreen: 'green', green: 'green', yellow: 'yellow', orange: 'yellow', red: 'red' };

function paint(text, color, useColor) {
  return useColor ? `\x1b[${COLORS[color]}m${text}\x1b[0m` : text;
}

function describeScope(result) {
  if (result.mode === 'all') {
    return 'all tracked files';
  }
  if (result.mode === 'staged') {
    return 'staged changes';
  }
  return result.base ? `changes since ${result.base}` : 'uncommitted changes';
}

function findingRow(lineNumber, finding, useColor) {
  return `${lineNumber}  ${paint(finding.rule.padEnd(RULE_COLUMN), 'dim', useColor)}${finding.message}`;
}

function byFileThenLine(a, b) {
  if (a.file !== b.file) {
    return a.file < b.file ? -1 : 1;
  }
  return a.line - b.line;
}

function countBySeverity(findings) {
  let high = 0;
  let medium = 0;
  let low = 0;
  for (const finding of findings) {
    if (finding.weight >= 5) {
      high += 1;
    } else if (finding.weight >= 3) {
      medium += 1;
    } else {
      low += 1;
    }
  }
  return `${high} high, ${medium} medium, ${low} low.`;
}

export function formatText(result, options) {
  const useColor = options.color;
  const fileWord = result.files === 1 ? 'file' : 'files';
  let lineWord = result.addedLines === 1 ? 'line' : 'lines';
  if (result.mode !== 'all') {
    lineWord = `added ${lineWord}`;
  }
  const out = [`slop-check  ${describeScope(result)}  ${result.files} ${fileWord}, ${result.addedLines} ${lineWord}`, ''];

  if (result.addedLines === 0 && result.findings.length === 0) {
    out.push('Nothing to check. Use --all to check every tracked file.', '');
    return out.join('\n');
  }

  const fileFindings = result.findings.filter((finding) => finding.file);
  fileFindings.sort(byFileThenLine);
  let currentFile = null;
  for (const finding of fileFindings) {
    if (finding.file !== currentFile) {
      if (currentFile !== null) {
        out.push('');
      }
      out.push(paint(finding.file, 'bold', useColor));
      currentFile = finding.file;
    }
    out.push(findingRow(String(finding.line).padStart(4), finding, useColor));
  }

  let currentCommit = null;
  for (const finding of result.findings.filter((item) => item.commit)) {
    if (finding.commit !== currentCommit) {
      out.push('', paint(`commit ${finding.commit}`, 'bold', useColor));
      currentCommit = finding.commit;
    }
    out.push(findingRow('    ', finding, useColor));
  }

  if (result.findings.length > 0) {
    out.push('');
  }
  const scoreText = paint(`Slop score: ${result.score}/100  ${result.label}`, SCORE_COLORS[result.color], useColor);
  const summary = result.findings.length === 0 ? 'No slop found.' : countBySeverity(result.findings);
  out.push(scoreText, `${summary}  Run with --badge to add it to your README.`, '');
  return out.join('\n');
}

export function formatJson(result) {
  const output = {
    score: result.score,
    label: result.label,
    base: result.base,
    mode: result.mode,
    files: result.files,
    addedLines: result.addedLines,
    findings: result.findings,
  };
  return `${JSON.stringify(output, null, 2)}\n`;
}
