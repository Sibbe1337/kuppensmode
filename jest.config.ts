import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  clearMocks: true,
  coverageDirectory: 'coverage',
  roots: ['<rootDir>/src'], // Adjusted to be relative to where jest.config.ts is
  testMatch: [
    // Adjusted to be more standard and relative to roots
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[tj]s?(x)',
  ],
};

export default config;