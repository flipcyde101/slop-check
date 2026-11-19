import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../src/rules.js';
import { checkFile } from '../src/check.js';

const EM_DASH = String.fromCharCode(0x2014);
const DEFAULT_RULES = new Set(RULES.filter((rule) => rule.defaultOn).map((rule) => rule.id));
const ALL_RULES = new Set(RULES.map((rule) => rule.id));

function ruleIds(path, lines, enabled = ALL_RULES) {
  const file = { path, lines: lines.map((text, index) => ({ number: index + 1, text })) };
  return checkFile(file, enabled).map((finding) => finding.rule);
}

function assertFlags(rule, path, line) {
  assert.ok(ruleIds(path, [line]).includes(rule), `expected ${rule} on: ${line}`);
}

function assertClean(rule, path, line) {
  assert.ok(!ruleIds(path, [line]).includes(rule), `did not expect ${rule} on: ${line}`);
}

describe('placeholder-code', () => {
  test('flags pasted placeholders', () => {
    assertFlags('placeholder-code', 'a.js', '// ... existing code ...');
    assertFlags('placeholder-code', 'a.js', '  // ... rest of the code');
    assertFlags('placeholder-code', 'a.ts', '// TODO: implement');
    assertFlags('placeholder-code', 'a.js', '// your code here');
    assertFlags('placeholder-code', 'a.py', '# implementation goes here');
  });
  test('leaves normal comments alone', () => {
    assertClean('placeholder-code', 'a.js', '// TODO: cache this');
    assertClean('placeholder-code', 'a.js', '// TODO: implement pagination');
    assertClean('placeholder-code', 'a.js', 'const rest = code.slice(1)');
  });
});

describe('debug-leftover', () => {
  test('flags debug output', () => {
    assertFlags('debug-leftover', 'a.js', '  debugger;');
    assertFlags('debug-leftover', 'a.py', 'breakpoint()');
    assertFlags('debug-leftover', 'a.py', 'import pdb; pdb.set_trace()');
    assertFlags('debug-leftover', 'a.js', 'console.debug(x)');
    assertFlags('debug-leftover', 'a.js', "console.log('user:', user)");
    assertFlags('debug-leftover', 'a.js', 'console.log("debug", x)');
    assertFlags('debug-leftover', 'a.js', "console.log('here')");
  });
  test('leaves real output and tests alone', () => {
    assertClean('debug-leftover', 'a.js', 'console.log(output)');
    assertClean('debug-leftover', 'a.js', "console.log('Saved 3 files')");
    assertClean('debug-leftover', 'src/a.test.js', 'debugger;');
  });
  test('leaves format strings and doc examples alone (calibration)', () => {
    assertClean('debug-leftover', 'a.js', "verbose && console.log('\\n   %s:', name);");
    assertClean('debug-leftover', 'scripts/report.js', "console.log('Rows found:', rows.length);");
    assertClean('debug-leftover', 'src/server.js', "console.log('Listening on port:', port);");
    assertClean('debug-leftover', 'src/a.js', "console.log('============');");
    assertClean('debug-leftover', 'src/a.js', "console.log('\\n--- summary ---');");
    const docExample = ['/**', '@example', "console.log('Ky error occurred:', error.message);", '*/'];
    assert.ok(!ruleIds('a.ts', docExample).includes('debug-leftover'));
  });
});

describe('type-escape', () => {
  test('flags silenced types', () => {
    assertFlags('type-escape', 'a.ts', 'const x = y as any;');
    assertFlags('type-escape', 'a.ts', 'const f = (a: any) => a;');
    assertFlags('type-escape', 'a.ts', '// @ts-ignore');
    assertFlags('type-escape', 'a.py', 'x = f()  # type: ignore');
  });
  test('leaves typed code alone', () => {
    assertClean('type-escape', 'a.py', 'x = f()  # type: ignore[attr-defined]');
    assertClean('type-escape', 'a.js', 'const x = y as any;');
    assertClean('type-escape', 'a.ts', 'const company = getCompany();');
    assertClean('type-escape', 'a.ts', "const label = 'pick: any';");
    assertClean('type-escape', 'a.tsx', 'const t = y as unknown as T;');
    assertClean('type-escape', 'test/hooks.ts', 'parent.extend((options: any) => {');
  });
});

describe('change-history-comment', () => {
  test('flags comments about the edit', () => {
    assertFlags('change-history-comment', 'a.js', '// Updated to use the new API');
    assertFlags('change-history-comment', 'a.js', '// Changed from map to set');
    assertFlags('change-history-comment', 'a.js', '// Added error handling');
    assertFlags('change-history-comment', 'a.py', '# Fixed the bug where');
    assertFlags('change-history-comment', 'a.js', '// New: retry');
  });
  test('leaves comments about the code alone', () => {
    assertClean('change-history-comment', 'a.js', '// Added items stay in the queue until flush');
    assertClean('change-history-comment', 'a.js', '// Fixed / variable rates use the base price');
    assertClean('change-history-comment', 'a.js', '// Fixed string length for the id column');
    assertClean('change-history-comment', 'a.js', '// Updated mapping table lives in the cache');
    assertClean('change-history-comment', 'a.js', "// Added to each user's roles; roles already there stay.");
    const continued = ruleIds('a.js', ['// The proxy check runs once the middleware is', '// added to the chain.']);
    assert.ok(!continued.includes('change-history-comment'));
  });
});

describe('narration-comment', () => {
  test('flags the AI talking', () => {
    assertFlags('narration-comment', 'a.js', '// Let me check');
    assertFlags('narration-comment', 'a.js', '// As requested, retry twice');
    assertFlags('narration-comment', 'a.js', "// I've added a guard");
  });
  test('leaves normal comments alone', () => {
    assertClean('narration-comment', 'a.js', '// lets the caller retry');
  });
  test('leaves common human phrasing alone (calibration)', () => {
    assertClean('narration-comment', 'a.go', "// Let's add the --help and --version flag ourselves");
    assertClean('narration-comment', 'a.js', '// here we validate the API key,');
    assertClean('narration-comment', 'a.go', '// Here we are validating the existing type');
    assertClean('narration-comment', 'a.js', '// Now we save');
    assertClean('narration-comment', 'build.sh', '# Step 1: build');
    assertClean('narration-comment', 'a.js', '// Step 1: parse');
  });
});

describe('disclaimer-comment', () => {
  test('flags disclaimers', () => {
    assertFlags('disclaimer-comment', 'a.js', '// In a real application you would cache this');
    assertFlags('disclaimer-comment', 'a.js', '// For demonstration purposes');
    assertFlags('disclaimer-comment', 'a.js', '// This is a simplified version');
    assertFlags('disclaimer-comment', 'a.js', '// You may want to add logging');
    assertFlags('disclaimer-comment', 'a.js', '// In production you would use a queue');
  });
  test('leaves explanations alone (calibration)', () => {
    assertClean('disclaimer-comment', 'a.js', '// Without this you would need to');
    assertClean('disclaimer-comment', 'a.py', "# For simplicity, we're going to assume that the client cert is");
  });
});

describe('placeholder-value', () => {
  test('flags placeholder values in code', () => {
    assertFlags('placeholder-value', 'a.js', 'const key = "your-api-key-here";');
    assertFlags('placeholder-value', 'a.js', "token: 'YOUR_API_KEY',");
    assertFlags('placeholder-value', 'a.js', 'const url = "<your-server-url>";');
    assertFlags('placeholder-value', 'a.py', 'password = "changeme"');
    assertFlags('placeholder-value', 'a.js', 'const secret = REPLACE_ME;');
  });
  test('leaves docs, examples and tests alone', () => {
    assertClean('placeholder-value', 'README.md', 'export TOKEN=YOUR_API_KEY');
    assertClean('placeholder-value', '.env.example', 'TOKEN=YOUR_API_KEY');
    assertClean('placeholder-value', 'test/a.js', "token: 'YOUR_API_KEY',");
  });
});

describe('emoji-in-code', () => {
  test('flags emoji in code', () => {
    assertFlags('emoji-in-code', 'a.js', 'console.log("✅ done")');
    assertFlags('emoji-in-code', 'a.js', "logger.info('🚀 started', { port })");
    assertFlags('emoji-in-code', 'a.py', 'print("✅ done")');
    assertFlags('emoji-in-code', 'a.js', '// 🚀 fast path');
  });
  test('leaves data, docs, tests and CI files alone (calibration)', () => {
    assertClean('emoji-in-code', '.github/workflows/ci.yml', 'group: "${{ github.workflow }} ✨ ${{ github.ref }}"');
    assertClean('emoji-in-code', '.github/workflows/codeql.yml', '# 📚 See https://docs.github.com/en/actions');
    assertClean('emoji-in-code', 'test/body-size.ts', "t.is(getBodySize('😀'), 4);");
    assertClean('emoji-in-code', 'source/ky.ts', "//=> `{data: '🦄'}`");
    assertClean('emoji-in-code', 'src/a.js', "const icon = '🦄';");
  });
  test('leaves markdown and copyright signs alone', () => {
    assertClean('emoji-in-code', 'README.md', '## Done ✅');
    assertClean('emoji-in-code', 'a.js', '// Copyright © 2026');
  });
});

describe('em-dash', () => {
  test('is off by default (calibration)', () => {
    assert.ok(!ruleIds('README.md', [`Fast ${EM_DASH} and safe.`], DEFAULT_RULES).includes('em-dash'));
  });
  test('flags em dashes in code and markdown when on', () => {
    assertFlags('em-dash', 'a.js', `// fast ${EM_DASH} and safe`);
    assertFlags('em-dash', 'README.md', `Fast ${EM_DASH} and safe.`);
  });
  test('gives one finding per line', () => {
    const ids = ruleIds('README.md', [`a ${EM_DASH} b ${EM_DASH} c`]);
    assert.equal(ids.filter((id) => id === 'em-dash').length, 1);
  });
});

describe('buzzword', () => {
  test('flags buzzwords in comments and markdown', () => {
    assertFlags('buzzword', 'a.js', '// delve into the data');
    assertFlags('buzzword', 'a.py', '# a testament to good design');
    assertFlags('buzzword', 'README.md', "It's worth noting that this is fast.");
  });
  test('leaves code alone', () => {
    assertClean('buzzword', 'a.js', 'const seamlessMode = true;');
    assertClean('buzzword', 'a.js', 'const mode = "seamless";');
  });
  test('leaves normal prose and names alone (calibration)', () => {
    assertClean('buzzword', 'a.js', ' * work seamlessly within Express.');
    assertClean('buzzword', 'README.md', '- [Delve](https://github.com/derekparker/delve)');
  });
});

describe('every line', () => {
  test('skips lines longer than 1000 characters', () => {
    const long = 'debugger; ' + 'x'.repeat(1000);
    assert.deepEqual(ruleIds('a.js', [long]), []);
  });
  test('skips lines marked slop-check-ignore', () => {
    assert.deepEqual(ruleIds('a.js', ['debugger; // slop-check-ignore']), []);
  });
  test('skips files of unknown type', () => {
    assert.deepEqual(ruleIds('a.xyz', ['debugger;']), []);
  });
  test('findings carry file, line, weight and message', () => {
    const file = { path: 'a.js', lines: [{ number: 7, text: 'debugger;' }] };
    assert.deepEqual(checkFile(file, DEFAULT_RULES), [
      { rule: 'debug-leftover', weight: 3, message: 'Debug output left behind.', file: 'a.js', line: 7 },
    ]);
  });
});

describe('speed', () => {
  test('an unclosed quote followed by many escapes finishes fast', () => {
    const line = `const USAGE: &'static str = "Usage:${'\\n  -x'.repeat(22)}`;
    const start = performance.now();
    ruleIds('main.rs', [line]);
    assert.ok(performance.now() - start < 100, `took ${performance.now() - start} ms`);
  });
});
