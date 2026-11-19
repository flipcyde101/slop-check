// The file GitHub runs. It always starts the action, so a symlinked action path
// can never skip the check and pass by doing nothing.
import { runAction } from './action.js';

const cwd = process.env.GITHUB_WORKSPACE || process.cwd();
const outcome = await runAction({ env: process.env, fetchFn: fetch, cwd });
if (outcome.failed) {
  process.exitCode = 1;
}
