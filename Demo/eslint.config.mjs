import js from '@eslint/js';
import globals from 'globals';

export default [
  {ignores: ['android/**', 'ios/**', 'node_modules/**']},
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {globals: {...globals.node, ...globals.jest}},
  },
];
