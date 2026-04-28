import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";
import yml from "eslint-plugin-yml";

export default defineConfig(
  {
    ignores: [".venv/**", "dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  ...yml.configs["flat/recommended"],
  {
    files: ["**/*.{yml,yaml}"],
    rules: {
      "yml/file-extension": ["error", { extension: "yml" }],
    },
  },
  {
    files: [".github/workflows/*.yml"],
    rules: {
      "yml/no-empty-mapping-value": "off",
    },
  },
);
