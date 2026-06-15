'use strict';

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['./tests/helpers/env.js'],
  // Runs after the test framework is installed, so jest.retryTimes is available.
  setupFilesAfterEnv: ['./tests/helpers/retry.js'],
  testTimeout: 15000,
  verbose: true,
  forceExit: true,
};
