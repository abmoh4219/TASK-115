/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(ts|mjs|js|cjs)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  moduleNameMapper: {
    '@core/(.*)': '<rootDir>/src/app/core/$1',
    '@shared/(.*)': '<rootDir>/src/app/shared/$1',
    '@features/(.*)': '<rootDir>/src/app/features/$1',
  },
  testMatch: [
    '<rootDir>/tests/unit_tests/**/*.spec.ts',
    '<rootDir>/src/**/*.spec.ts',
  ],
  coverageDirectory: 'jest-coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/app/core/services/**/*.ts',
    'src/app/core/guards/**/*.ts',
    'src/app/shared/pipes/**/*.ts',
    'src/app/shared/components/**/*.ts',
    'src/app/features/login/**/*.ts',
    '!**/*.module.ts',
    '!**/index.ts',
  ],
  cacheDirectory: '.jest-cache',
  testTimeout: 60000,
};
