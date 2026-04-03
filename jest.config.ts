/**
 * Jest Configuration
 * jest.config.ts
 */
import type { Config } from "jest";
import nextJest from "next/jest";

const createJestConfig = nextJest({
  dir: "./",
});

const config: Config = {
  setupFilesAfterFramework: ["<rootDir>/lib/__tests__/setup.ts"],
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: "tsconfig.json",
      useESM: true,
    }],
  },
  transformIgnorePatterns: [
    "node_modules/(?!(jose)/)",
  ],
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/.next/",
  ],
  collectCoverageFrom: [
    "lib/**/*.ts",
    "!lib/**/*.d.ts",
    "!lib/__tests__/**",
  ],
  coverageDirectory: "coverage",
  verbose: true,
};

export default createJestConfig(config);
