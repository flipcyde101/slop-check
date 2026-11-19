// Runs the enabled rules over one file's added lines.

import { getComment } from './comments.js';
import { getExtension, getLanguage, isExampleFile, isTestFile } from './languages.js';
import { RULES } from './rules.js';

// Very long lines are almost always minified or generated code.
const MAX_LINE_LENGTH = 1000;
const IGNORE_MARKER = 'slop-check-ignore';

function commentOf(text, style) {
  return style === 'text' ? null : getComment(text, style);
}

export function checkFile(file, enabled) {
  const language = getLanguage(file.path);
  if (!language) {
    return [];
  }

  const info = {
    path: file.path,
    style: language.style,
    extension: getExtension(file.path),
    isTest: isTestFile(file.path),
    isExample: isExampleFile(file.path),
  };
  const rules = RULES.filter((rule) => rule.scope === 'line' && enabled.has(rule.id) && rule.appliesTo(info));
  const findings = [];

  for (let i = 0; i < file.lines.length; i += 1) {
    const line = file.lines[i];
    if (line.text.length > MAX_LINE_LENGTH || line.text.includes(IGNORE_MARKER)) {
      continue;
    }

    // A rule may only look ahead at a line this change also added, right below.
    const following = file.lines[i + 1];
    let next = null;
    if (following && following.number === line.number + 1) {
      next = { number: following.number, text: following.text, comment: commentOf(following.text, info.style) };
    }

    const ctx = { text: line.text, comment: commentOf(line.text, info.style), next, file: info };
    for (const rule of rules) {
      if (rule.check(ctx)) {
        findings.push({ rule: rule.id, weight: rule.weight, message: rule.message, file: file.path, line: line.number });
      }
    }
  }

  return findings;
}
