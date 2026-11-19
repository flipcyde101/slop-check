// Finds the comment part of one line of code, without understanding the language.
// A marker counts only outside quotes and at the line start or after whitespace,
// so "https://x.io" and color: "#fff" are not comments.

const MARKERS = { slash: '//', hash: '#', dash: '--' };
const QUOTES = ['"', "'", '`'];

function cleanBlockComment(text) {
  return text.replace(/^\/\*+/, '').replace(/^\*+/, '').replace(/\*\/\s*$/, '').trim();
}

function findInlineMarker(text, marker) {
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === '\\') {
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (QUOTES.includes(char)) {
      quote = char;
      continue;
    }
    const startsHere = text.startsWith(marker, i);
    const afterSpace = i === 0 || text[i - 1] === ' ' || text[i - 1] === '\t';
    if (startsHere && afterSpace) {
      return i;
    }
  }
  return -1;
}

export function getComment(text, style) {
  const trimmed = text.trimStart();

  if (style === 'slash' && (trimmed.startsWith('/*') || trimmed.startsWith('*'))) {
    return cleanBlockComment(trimmed);
  }
  if (style === 'hash' && trimmed.startsWith('#!')) {
    return null;
  }

  const marker = MARKERS[style];
  const index = findInlineMarker(trimmed, marker);
  if (index === -1) {
    return null;
  }
  return trimmed.slice(index + marker.length).replace(/^[/#-]+/, '').trim();
}
