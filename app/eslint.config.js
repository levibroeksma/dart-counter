import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const deepImportRestriction = {
  patterns: [
    {
      group: ["@lib/shared/games/501/*"],
      message: "Import from @lib/shared/games/501 barrel instead.",
    },
    {
      group: ["@lib/shared/dartbot/*"],
      message: "Import from @lib/shared/dartbot barrel instead.",
    },
    {
      group: ["@lib/shared/darts/*"],
      message: "Import from @lib/shared/darts barrel instead.",
    },
    {
      group: ["@lib/shared/games/score-training/*"],
      message: "Import from @lib/shared/games/score-training barrel instead.",
    },
    {
      group: ["@lib/shared/games/singles-training/*"],
      message: "Import from @lib/shared/games/singles-training barrel instead.",
    },
    {
      group: ["@lib/shared/games/ten-up-one-down/*"],
      message: "Import from @lib/shared/games/ten-up-one-down barrel instead.",
    },
    {
      group: ["@lib/shared/stats/*"],
      message: "Import from @lib/shared/stats barrel instead.",
    },
  ],
};

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", ".astro/**", "node_modules/**", "**/*.astro"],
  },
  {
    files: ["src/**/*.{ts,astro}", "tests/**/*.{ts,tsx}", "scripts/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", deepImportRestriction],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/lib/shared/games/501/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: ["src/lib/shared/dartbot/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: ["src/lib/shared/darts/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: ["src/lib/shared/games/score-training/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: ["src/lib/shared/games/singles-training/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: ["src/lib/shared/games/ten-up-one-down/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: ["src/lib/shared/stats/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: [
      "tests/lib/shared/games/501/leg-estimate.test.ts",
      "tests/lib/shared/games/501/match.test.ts",
      "tests/lib/shared/games/501/visit.test.ts",
      "tests/lib/shared/games/score-training/validation.test.ts",
      "tests/lib/shared/games/score-training/state.test.ts",
      "tests/lib/shared/games/singles-training/dart.test.ts",
      "tests/lib/shared/games/singles-training/target-sequence.test.ts",
      "tests/lib/shared/games/singles-training/state.test.ts",
      "tests/lib/shared/games/singles-training/summary.test.ts",
      "tests/lib/shared/games/singles-training/stats.test.ts",
      "tests/lib/shared/games/singles-training/session-factory.test.ts",
      "tests/lib/shared/games/singles-training/completion.test.ts",
      "tests/lib/shared/games/ten-up-one-down/state.test.ts",
      "tests/lib/shared/games/ten-up-one-down/target.test.ts",
      "tests/lib/shared/dartbot/checkout-planner.test.ts",
      "tests/lib/shared/dartbot/checkout-knowledge.test.ts",
      "tests/lib/shared/dartbot/strategy-engine.test.ts",
      "tests/lib/shared/dartbot/throw-engine.test.ts",
      "tests/lib/shared/darts/doubles.test.ts",
    ],
    rules: { "no-restricted-imports": "off" },
  },
);
