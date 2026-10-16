// Tests: real Express app (supertest) + in-memory MongoDB + local Redis (DB 15).
// Redis must be running (docker start beyownd-redis) - tests flush DB 15 only.
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  setupFiles: ['<rootDir>/tests/setup/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/db.ts'],
  // One shared Redis DB → run test files one at a time
  maxWorkers: 1,
  testTimeout: 30000,
};
