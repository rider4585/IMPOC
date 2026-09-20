export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js', '**/src/**/__tests__/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
  ],
  transform: {},
  testTimeout: 15000,
  maxWorkers: 1,
};
