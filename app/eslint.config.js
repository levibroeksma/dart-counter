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
    files: [
      "tests/lib/shared/games/501/leg-estimate.test.ts",
      "tests/lib/shared/games/501/match.test.ts",
      "tests/lib/shared/games/501/visit.test.ts",
      "tests/lib/shared/dartbot/checkout-planner.test.ts",
      "tests/lib/shared/dartbot/checkout-knowledge.test.ts",
      "tests/lib/shared/dartbot/strategy-engine.test.ts",
      "tests/lib/shared/dartbot/throw-engine.test.ts",
    ],
    rules: { "no-restricted-imports": "off" },
  },
);
