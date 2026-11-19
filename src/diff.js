// Turns `git diff` output into the lines each file added, with their new line numbers.

const HUNK_HEADER = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function readPath(headerLine) {
  let path = headerLine.slice(4).replace(/\t$/, '');
  if (path === '/dev/null') {
    return null;
  }
  if (path.startsWith('"') && path.endsWith('"')) {
    path = path.slice(1, -1).replace(/\\(.)/g, (match, char) => (char === 't' ? '\t' : char));
  }
  return path.startsWith('b/') ? path.slice(2) : path;
}

export function parseDiff(text) {
  const files = [];
  let current = null;
  let newLine = 0;
  let oldLeft = 0;
  let newLeft = 0;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '');

    // Inside a hunk the header counts tell us how many lines belong to it,
    // so a content line such as "+++x" is never mistaken for a file header.
    if (oldLeft > 0 || newLeft > 0) {
      const marker = line[0];
      if (marker === '+') {
        if (current) {
          current.lines.push({ number: newLine, text: line.slice(1) });
        }
        newLine += 1;
        newLeft -= 1;
      } else if (marker === '-') {
        oldLeft -= 1;
      } else if (marker === ' ' || line === '') {
        newLine += 1;
        newLeft -= 1;
        oldLeft -= 1;
      }
      continue;
    }

    if (line.startsWith('diff --git ')) {
      current = null;
    } else if (line.startsWith('+++ ')) {
      const path = readPath(line);
      current = path ? { path, lines: [] } : null;
      if (current) {
        files.push(current);
      }
    } else {
      const hunk = HUNK_HEADER.exec(line);
      if (hunk) {
        oldLeft = hunk[1] === undefined ? 1 : Number(hunk[1]);
        newLine = Number(hunk[2]);
        newLeft = hunk[3] === undefined ? 1 : Number(hunk[3]);
      }
    }
  }

  return files.filter((file) => file.lines.length > 0);
}
