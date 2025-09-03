// /eslint.config.mjs
// ESLint configuration for Next.js 15
// Using the new flat config format

import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.config({
    extends: ["next/core-web-vitals"],
  }),
  {
    ignores: [".next/*", "node_modules/*", "*.config.*"]
  }
];

export default eslintConfig;