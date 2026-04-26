/** @type {import('jest').Config} */
export default {
  displayName: 'weak-storage',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testMatch: ['**/*.spec.ts'],
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.spec.ts',
    '!**/*.d.ts',
    '!index.ts',
    '!jest.config.js',
  ],
  coverageDirectory: 'coverage',
};
