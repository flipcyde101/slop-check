import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

export function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'slop-check-test-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.name', 'Test');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'commit.gpgsign', 'false');
  writeFileSync(join(dir, 'clean.js'), 'const a = 1;\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'chore: start');
  return dir;
}

export function commitFile(dir, path, content, message = 'feat: change') {
  writeFileSync(join(dir, path), content);
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', message);
}

// A repo on branch `feature` with one high finding (empty catch) in 3 lines.
export function makeDirtyBranch() {
  const dir = makeRepo();
  git(dir, 'checkout', '-q', '-b', 'feature');
  commitFile(dir, 'b.js', 'try {\n  run();\n} catch (e) {}\n');
  return dir;
}
