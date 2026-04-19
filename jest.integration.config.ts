const base = require('./jest.unit.config');
/** @type {import('jest').Config} */
module.exports = {
  ...base,
  testMatch: ['**/tests/**/*.test.ts'],
  setupFilesAfterEnv: [],
  testEnvironment: 'node',
  roots: ['<rootDir>/..'],
  rootDir: '..',
};