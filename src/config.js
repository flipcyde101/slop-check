// Reads the optional .slopcheckrc.json and decides which files and rules are used.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from './rules.js';

const CONFIG_FILE = '.slopcheckrc.json';

export const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/vendor/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/coverage/**',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '*.lock',
  '*.min.js',
  '*.map',
  '*.snap',
  '*.gen.*',
  '*.generated.*',
];

function globToRegExp(pattern) {
  let source = '';
  let i = 0;
  while (i < pattern.length) {
    if (pattern.startsWith('**/', i)) {
      source += '(?:.*/)?';
      i += 3;
    } else if (pattern.startsWith('**', i)) {
      source += '.*';
      i += 2;
    } else if (pattern[i] === '*') {
      source += '[^/]*';
      i += 1;
    } else if (pattern[i] === '?') {
      source += '[^/]';
      i += 1;
    } else {
      source += pattern[i].replace(/[.+^${}()|[\]\\]/g, '\\$&');
      i += 1;
    }
  }
  return new RegExp(`^${source}$`);
}

export function matchGlob(pattern, path) {
  const fullPattern = pattern.includes('/') ? pattern : `**/${pattern}`;
  return globToRegExp(fullPattern).test(path);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function loadConfig(rootDir) {
  const config = { rules: {}, ignore: [], maxScore: null, warnings: [] };
  const path = join(rootDir, CONFIG_FILE);
  if (!existsSync(path)) {
    return config;
  }

  let raw;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    config.warnings.push(`could not read ${CONFIG_FILE}: ${error.message}`);
    return config;
  }

  if (!isPlainObject(raw)) {
    config.warnings.push(`${CONFIG_FILE} must hold a JSON object`);
    return config;
  }
  if (raw.rules !== undefined && !isPlainObject(raw.rules)) {
    config.warnings.push(`"rules" in ${CONFIG_FILE} must be an object such as { "em-dash": "on" }`);
    raw.rules = {};
  }

  const knownIds = RULES.map((rule) => rule.id);
  for (const [id, value] of Object.entries(raw.rules || {})) {
    if (!knownIds.includes(id)) {
      config.warnings.push(`unknown rule "${id}" in ${CONFIG_FILE}`);
    } else if (value !== 'on' && value !== 'off') {
      config.warnings.push(`rule "${id}" in ${CONFIG_FILE} must be "on" or "off"`);
    } else {
      config.rules[id] = value;
    }
  }

  if (raw.ignore !== undefined) {
    const isList = Array.isArray(raw.ignore) && raw.ignore.every((item) => typeof item === 'string');
    if (isList) {
      config.ignore = raw.ignore;
    } else {
      config.warnings.push(`"ignore" in ${CONFIG_FILE} must be a list of patterns`);
    }
  }

  if (raw.maxScore !== undefined) {
    if (Number.isInteger(raw.maxScore) && raw.maxScore >= 0 && raw.maxScore <= 100) {
      config.maxScore = raw.maxScore;
    } else {
      config.warnings.push(`"maxScore" in ${CONFIG_FILE} must be a whole number from 0 to 100`);
    }
  }

  return config;
}

export function enabledRules(config) {
  const enabled = new Set();
  for (const rule of RULES) {
    const setting = config.rules[rule.id];
    if (setting === 'on' || (setting === undefined && rule.defaultOn)) {
      enabled.add(rule.id);
    }
  }
  return enabled;
}

export function isIgnored(path, config) {
  for (const pattern of [...DEFAULT_IGNORE, ...config.ignore]) {
    if (matchGlob(pattern, path)) {
      return true;
    }
  }
  return false;
}
