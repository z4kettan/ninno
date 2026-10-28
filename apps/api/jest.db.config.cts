/** Database tests (`*.db.spec.ts`), run with `nx run api:test-db` against DATABASE_URL_TEST. */
module.exports = {
  displayName: 'api-db',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  testMatch: ['<rootDir>/src/**/*.db.spec.ts', '<rootDir>/../../prisma/**/*.db.spec.ts'],
  // Each run gets its own throwaway database; see test/db/global-setup.ts.
  globalSetup: '<rootDir>/test/db/global-setup.ts',
  globalTeardown: '<rootDir>/test/db/global-teardown.ts',
  // Tests share one database and truncate between cases.
  maxWorkers: 1,
  coverageDirectory: '../../coverage/apps/api-db',
};
