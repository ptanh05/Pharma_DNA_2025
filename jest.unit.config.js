/** @type {import('jest').Config} */
module.exports = {
  setupFiles: ["<rootDir>/lib/__tests__/setup.js"],
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: "tsconfig.test.json",
    }],
  },
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
