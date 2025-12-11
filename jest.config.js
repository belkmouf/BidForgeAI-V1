export default {
  projects: [
    {
      displayName: "server",
      preset: "ts-jest/presets/default-esm",
      testEnvironment: "node",
      roots: ["<rootDir>/server"],
      testMatch: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
      testPathIgnorePatterns: ["/node_modules/", "/__tests__/utils/"],
      extensionsToTreatAsEsm: [".ts"],
      moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
        "^@shared/(.*)$": "<rootDir>/shared/$1",
      },
      setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            tsconfig: "tsconfig.test.json",
            useESM: true,
            diagnostics: false,
          },
        ],
      },
      transformIgnorePatterns: [
        "node_modules/(?!(@neondatabase|p-queue|@langchain|eventemitter3|langchain)/)",
      ],
      collectCoverageFrom: [
        "server/**/*.ts",
        "!server/**/*.d.ts",
        "!server/index.ts",
        "!**/node_modules/**",
      ],
    },
    {
      displayName: "client",
      testEnvironment: "jsdom",
      roots: ["<rootDir>/client/src"],
      testMatch: ["**/__tests__/**/*.tsx", "**/*.test.tsx"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/client/src/$1",
        "^@shared/(.*)$": "<rootDir>/shared/$1",
        "\\.(css|less|scss|sass)$": "identity-obj-proxy",
      },
      setupFilesAfterEnv: [
        "<rootDir>/jest.setup.js",
        "@testing-library/jest-dom",
      ],
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            tsconfig: {
              jsx: "react",
              esModuleInterop: true,
              allowSyntheticDefaultImports: true,
            },
            useESM: false,
          },
        ],
      },
      collectCoverageFrom: [
        "client/src/**/*.{ts,tsx}",
        "!client/src/**/*.d.ts",
        "!**/node_modules/**",
      ],
    },
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    "./server/lib/": {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    "./server/middleware/": {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  collectCoverage: false,
  coverageDirectory: "coverage",
};
