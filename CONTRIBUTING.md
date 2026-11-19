# Contributing to slop-check

Thanks for helping. The most useful things you can send, in order:

1. **A false positive.** slop-check flagged a line a careful person wrote on
   purpose. This is the bug that matters most, because one silly finding is
   enough for someone to uninstall the tool.
   [Report it here](https://github.com/tisankanj/slop-check/issues/new?template=false-positive.yml).
2. **A missed leftover.** AI left something in a diff that no rule caught.
   [Suggest a rule](https://github.com/tisankanj/slop-check/issues/new?template=rule-idea.yml).
3. **A pull request** for one of the
   [good first issues](https://github.com/tisankanj/slop-check/labels/good%20first%20issue).

## Setup

```bash
git clone https://github.com/tisankanj/slop-check.git
cd slop-check
node --test                      # run every test (Node.js 20 or newer)
node bin/slop-check.js --all     # run slop-check on itself, should score 0
```

There is nothing to install. Zero dependencies is on purpose; please keep it that
way.

## How the code is laid out

| File | Job |
| --- | --- |
| `bin/slop-check.js` | Reads flags, prints the report, sets the exit code |
| `src/run.js` | Runs the whole check; the CLI and the Action both call it |
| `src/git.js` | Every git command: repo root, base, diff, commit messages |
| `src/diff.js` | Turns `git diff` output into added lines per file |
| `src/comments.js` | Finds the comment part of a line |
| `src/check.js` | Runs the enabled rules over each file and commit |
| `src/rules.js` | Every rule, one plain object each |
| `src/score.js` | Score, label and badge |
| `src/report.js` | Text and JSON output |
| `src/config.js` | `.slopcheckrc.json` and ignore patterns |
| `src/action.js` | GitHub Action entry |

## Adding or changing a rule

1. Add or change the rule object in `src/rules.js`. Keep the message to one
   plain sentence that says what to do.
2. Add tests with two kinds of cases: lines it **flags**, and lines it **does
   not flag**. Every false positive you know about becomes a "does not flag" case.
3. Run it on a few repos written by people, for example:

   ```bash
   git clone --depth 1 https://github.com/expressjs/express /tmp/express
   cd /tmp/express && node /path/to/slop-check/bin/slop-check.js --all --json
   ```

   **The bar: the rule may be wrong at most once in ten findings.** Say in the
   pull request which repos you tried and how many findings were wrong.
4. Add a section to `docs/rules.md` with a bad and a good example, and a row to
   the rules table in `README.md`.

## Code style

- Plain names, short functions, no clever one-liners.
- Comments explain why, never what the next line does. (slop-check checks this.)
- Errors the user can fix are thrown as `SlopCheckError` with a message that
  says what to do. Anything else is a bug and may crash with a stack trace.
- Commit messages: `feat:`, `fix:`, `docs:`, `test:` or `chore:`, then a short
  plain sentence.

## Pull requests

Keep each pull request to one change. CI runs the tests on Node 20, 24 and 26
and runs slop-check on your diff with `max-score: 0`, so your change has to pass
its own tool.
