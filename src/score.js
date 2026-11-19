// Turns findings into one number: slop points per 100 added lines, capped at 100.

const MIN_LINES = 20;
const EM_DASH_CAP = 5;

const BANDS = [
  { max: 0, label: 'Hand-written', color: 'brightgreen' },
  { max: 10, label: 'Mostly human', color: 'green' },
  { max: 30, label: 'Needs a once-over', color: 'yellow' },
  { max: 60, label: 'Sloppy', color: 'orange' },
  { max: 100, label: 'Pure slop', color: 'red' },
];

export function scoreFindings(findings, addedLines) {
  let points = 0;
  // One long markdown file full of em dashes should not drown out real problems.
  const emDashPointsByPlace = new Map();

  for (const finding of findings) {
    if (finding.rule !== 'em-dash') {
      points += finding.weight;
      continue;
    }
    const place = finding.file || `commit ${finding.commit}`;
    const used = emDashPointsByPlace.get(place) || 0;
    if (used < EM_DASH_CAP) {
      emDashPointsByPlace.set(place, used + finding.weight);
      points += finding.weight;
    }
  }

  const lines = Math.max(addedLines, MIN_LINES);
  const score = Math.min(100, Math.round((points * 100) / lines));
  const band = BANDS.find((item) => score <= item.max);
  return { score, points, label: band.label, color: band.color };
}

export function badgeMarkdown(score, color) {
  return `[![slop score](https://img.shields.io/badge/slop_score-${score}-${color})](https://github.com/tisankanj/slop-check)`;
}
