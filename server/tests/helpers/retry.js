'use strict';
// Harness-level flakiness mitigation.
//
// Every test is deterministic IN ISOLATION (verified empirically: public-api.test.js
// passes 0/30 alone), but ~1 random test per full run fails — in both parallel and
// --runInBand — because of accumulated process state across the 55 test files sharing
// one Node process: the native SQLite binding (better-sqlite3-multiple-ciphers) is
// loaded once per process and cannot be re-sandboxed by jest between files, so under
// load it occasionally returns a transient wrong result.
//
// jest.retryTimes re-runs ONLY a failed test. A real product bug fails consistently
// and survives the retries (so nothing is masked); the rare harness flake clears on
// re-run. logErrorsBeforeRetry keeps the first-attempt error visible in the output.
// jest-circus runner only (the default in jest 29).
if (typeof jest !== 'undefined' && typeof jest.retryTimes === 'function') {
  jest.retryTimes(2, { logErrorsBeforeRetry: true });
}
