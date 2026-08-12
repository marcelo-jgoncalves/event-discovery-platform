// code-conventions.md: type-aware linting required in services/. `any` is
// banned by lint except in test files with justification.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'eslint.config.mjs'],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // node:test's test() returns a promise resolved when the test runs
      // async, but the call itself is fire-and-forget by design of the
      // test runner — the same pattern node:test's own docs use.
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
);
