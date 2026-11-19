// Every rule slop-check knows. Each rule looks at one added line (or one line of a
// commit message) and answers yes or no. Weights: high 5, medium 3, low 1.

export const EM_DASH = String.fromCharCode(0x2014);

const HIGH = 5;
const MEDIUM = 3;
const LOW = 1;

const TYPESCRIPT_EXTENSIONS = ['ts', 'tsx', 'mts', 'cts'];

const PLACEHOLDER_CODE = [
  /^(?:\.{3}|…)\s*(?:existing|rest of|remaining|other|previous|unchanged)\b/i,
  /^todo:?\s*implement\b/i,
  /\byour code (?:goes )?here\b/i,
  /\bimplementation goes here\b/i,
];

const DEBUG_OUTPUT = [
  /^\s*debugger\s*;?\s*$/,
  /\bbreakpoint\(\)/,
  /\bpdb\.set_trace\(\)/,
  /\bconsole\.debug\(/,
  /\bconsole\.log\(\s*(['"`])[^'"`]*:\s*\1\s*,/,
  /\bconsole\.log\(\s*(['"`])[^'"`]*(?:\bdebug\b|\bhere\b|\btesting\b|\btest\b|>>>|===|---)/i,
];

const TYPESCRIPT_ESCAPES = [/\bas any\b/, /:\s*any\b(?![\w$])/, /\bas unknown as\b/];

const HISTORY_VERB = /^(?:updated|changed|modified|added|removed|replaced|refactored|fixed)\s+(\S+)(?:\s+(\S+))?/i;
const HISTORY_NEXT_WORDS = [
  'to', 'from', 'the', 'a', 'an', 'this', 'that', 'support', 'proper', 'missing',
  'new', 'unused', 'extra', 'redundant', 'old',
];

const NARRATION = /^(?:let[’']s|let us|let me|here we|now we|now let[’']s|as requested|as you requested|i[’']ve|i have|i[’']ll|step \d+\s*[:.)])/i;

const DISCLAIMERS = [
  /\bin a real(?:[- ]world)? (?:app|application|project|scenario|system|implementation)\b/i,
  /\bfor (?:demo|demonstration|illustration|illustrative|example) purposes\b/i,
  /\bfor simplicity\b/i,
  /\bthis is a (?:simplified|basic|simple|naive|mock|placeholder)\b/i,
  /\byou (?:may|might|would|will) (?:want|need) to\b/i,
  /\bin production,? you (?:would|should|might)\b/i,
];

const PLACEHOLDER_VALUES = [
  /your[-_ ]?(?:api[-_ ]?key|secret|token|password)[-_ ]?here/i,
  /\bYOUR_[A-Z_]*(?:KEY|TOKEN|SECRET|PASSWORD|ID|URL)\b/,
  /(['"`])<your[-_ ][^>]+>\1/i,
  /\bREPLACE_ME\b/,
  /(['"`])changeme\1/i,
];

// The copyright, registered and trademark signs count as pictographic in Unicode.
const EMOJI = /(?![©®™])\p{Extended_Pictographic}/u;

const BUZZWORDS = [
  /\bdelv(?:e|es|ed|ing)\b/i,
  /\btapestry\b/i,
  /\bseamless(?:ly)?\b/i,
  /\bit[’']s worth noting\b/i,
  /\bin today[’']s fast[- ]paced\b/i,
  /\bgame[- ]changer\b/i,
  /\bunleash(?:es|ed|ing)?\b/i,
  /\belevate your\b/i,
  /\bembark(?:s|ed|ing)?\b/i,
  /\btestament to\b/i,
  /\bever[- ]evolving\b/i,
  /\bcutting[- ]edge\b/i,
  /\bsupercharg(?:e|es|ed|ing)\b/i,
  /\bnavigat(?:e|ing) the complexities\b/i,
];

function matchesAny(text, patterns) {
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

function isCodeFile(file) {
  return file.style !== 'text';
}

// Blank out string contents so `'pick: any'` is not read as a type.
function withoutStrings(text) {
  return text.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""');
}

function isHistoryComment(comment) {
  if (/^new:/i.test(comment)) {
    return true;
  }
  const match = HISTORY_VERB.exec(comment);
  if (!match) {
    return false;
  }
  const nextWords = [match[1], match[2] || ''].map((word) => word.toLowerCase());
  if (HISTORY_NEXT_WORDS.includes(nextWords[0])) {
    return true;
  }
  return nextWords[0].endsWith('ing') || nextWords[1].endsWith('ing');
}

export const RULES = [
  {
    id: 'empty-catch',
    weight: HIGH,
    defaultOn: true,
    scope: 'line',
    message: 'Error swallowed. Log it, handle it, or let it throw.',
    appliesTo: isCodeFile,
    check: () => false,
  },
  {
    id: 'placeholder-code',
    weight: HIGH,
    defaultOn: true,
    scope: 'line',
    message: 'Unfinished code pasted from a chat.',
    appliesTo: isCodeFile,
    check: (ctx) => ctx.comment !== null && matchesAny(ctx.comment, PLACEHOLDER_CODE),
  },
  {
    id: 'catch-rethrow',
    weight: MEDIUM,
    defaultOn: true,
    scope: 'line',
    message: 'This try/catch does nothing. Remove it.',
    appliesTo: isCodeFile,
    check: () => false,
  },
  {
    id: 'debug-leftover',
    weight: MEDIUM,
    defaultOn: true,
    scope: 'line',
    message: 'Debug output left behind.',
    appliesTo: (file) => isCodeFile(file) && !file.isTest,
    check: (ctx) => matchesAny(ctx.text, DEBUG_OUTPUT),
  },
  {
    id: 'type-escape',
    weight: MEDIUM,
    defaultOn: true,
    scope: 'line',
    message: 'The type checker was silenced instead of satisfied.',
    appliesTo: (file) => TYPESCRIPT_EXTENSIONS.includes(file.extension) || file.extension === 'py',
    check: (ctx) => {
      if (ctx.file.extension === 'py') {
        return ctx.comment !== null && /^type:\s*ignore\s*$/.test(ctx.comment);
      }
      if (ctx.comment !== null && ctx.comment.startsWith('@ts-ignore')) {
        return true;
      }
      return matchesAny(withoutStrings(ctx.text), TYPESCRIPT_ESCAPES);
    },
  },
  {
    id: 'change-history-comment',
    weight: MEDIUM,
    defaultOn: true,
    scope: 'line',
    message: 'Comments describe the code, not your edit. Put history in the commit.',
    appliesTo: isCodeFile,
    check: (ctx) => ctx.comment !== null && isHistoryComment(ctx.comment),
  },
  {
    id: 'narration-comment',
    weight: MEDIUM,
    defaultOn: true,
    scope: 'line',
    message: 'The AI is talking to you, not to the next reader.',
    appliesTo: isCodeFile,
    check: (ctx) => ctx.comment !== null && NARRATION.test(ctx.comment),
  },
  {
    id: 'disclaimer-comment',
    weight: MEDIUM,
    defaultOn: true,
    scope: 'line',
    message: 'If it matters in production, do it now or open an issue.',
    appliesTo: isCodeFile,
    check: (ctx) => ctx.comment !== null && matchesAny(ctx.comment, DISCLAIMERS),
  },
  {
    id: 'placeholder-value',
    weight: MEDIUM,
    defaultOn: true,
    scope: 'line',
    message: 'Placeholder value left in real code.',
    appliesTo: (file) => isCodeFile(file) && !file.isTest && !file.isExample,
    check: (ctx) => matchesAny(ctx.text, PLACEHOLDER_VALUES),
  },
  {
    id: 'restating-comment',
    weight: LOW,
    defaultOn: true,
    scope: 'line',
    message: 'Comment repeats the next line. Say why, or delete it.',
    appliesTo: isCodeFile,
    check: () => false,
  },
  {
    id: 'emoji-in-code',
    weight: LOW,
    defaultOn: true,
    scope: 'line',
    message: 'Emoji in code or logs.',
    appliesTo: isCodeFile,
    check: (ctx) => EMOJI.test(ctx.text),
  },
  {
    id: 'em-dash',
    weight: LOW,
    defaultOn: true,
    scope: 'line',
    message: 'The em dash is the best-known sign of unedited AI text.',
    appliesTo: () => true,
    check: (ctx) => ctx.text.includes(EM_DASH),
  },
  {
    id: 'buzzword',
    weight: LOW,
    defaultOn: true,
    scope: 'line',
    message: 'Marketing words where plain words would do.',
    appliesTo: () => true,
    check: (ctx) => {
      const text = ctx.file.style === 'text' ? ctx.text : ctx.comment;
      return text !== null && matchesAny(text, BUZZWORDS);
    },
  },
];
