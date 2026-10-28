module.exports = {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // DB tests run separately via `nx run api:test-db`.
  testPathIgnorePatterns: ['/node_modules/', '\\.db\\.spec\\.ts$'],
  coverageDirectory: '../../coverage/apps/api',
};
