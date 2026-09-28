import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [".claude/**", "Demo/**", "node_modules/**", "tmp/**"],
  },
  js.configs.recommended,
  {
    rules: {
      "no-unused-vars": ["error", {argsIgnorePattern: "^_", caughtErrors: "none"}],
    },
  },
  {
    files: ["index.js", "javascript/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.browser,
        __DEV__: "readonly",
        require: "readonly",
      },
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
  },
  {
    files: ["*.config.js", "react-native.config.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: globals.node,
    },
  },
  {
    files: ["__tests__/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
];
