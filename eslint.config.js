import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Sensible recommended TS rule set; no stylistic wall (keeps the diff small).
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // The CLI legitimately uses `any` at JSON/SDK boundaries; a sweeping
      // typing refactor is out of scope for this tests-and-tooling pass.
      '@typescript-eslint/no-explicit-any': 'off',
      // Allow intentionally-unused params prefixed with `_` (e.g. `_options`).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // `require` is never used in this ESM codebase; keep it quiet.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Lint the test suite with the same rules as the runtime source.
    files: ['src/**/*.test.ts'],
    rules: {
      // Tests routinely stub globals like fetch; allow explicit any in stubs.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '.chain/**'],
  },
);