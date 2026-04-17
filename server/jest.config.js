'use strict';

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['./tests/helpers/env.js'],
  testTimeout: 15000,
  verbose: true,
  forceExit: true,
};
