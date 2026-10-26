module.exports = {
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.spec.ts'],
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  testEnvironment: 'node',
  testTimeout: 30000,
};
