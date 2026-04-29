import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'database.types.ts',
      'apps/**',
      '**/*.md',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        // Edge functions run on Deno and reach for Web / DOM types (Fetch, Request/Response,
        // crypto, AbortController, etc.). `globals.browser` covers those without pulling in
        // DOM-only UI APIs. `globals` does not ship a `deno` key so Deno is declared explicitly.
        // DOM lib type-only identifiers (`RequestInit`, `RequestInfo`, `ResponseInit`,
        // `HeadersInit`, `BodyInit`) are not runtime globals but appear in `type` positions
        // across shared fetch helpers — declare them so `no-undef` ignores them.
        ...globals.browser,
        Deno: 'readonly',
        RequestInit: 'readonly',
        RequestInfo: 'readonly',
        ResponseInit: 'readonly',
        HeadersInit: 'readonly',
        BodyInit: 'readonly',
      },
    },
    rules: {
      'import/no-unresolved': 'off',
      'no-console': 'off',
      'no-undef': 'off',
      'prefer-const': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Edge functions run on Deno and are excluded from `tsc --noEmit` (tsconfig.json),
    // so undefined identifiers and dead imports slip past the Node typecheck.
    // Tightened rules here catch that failure class without pulling Deno into CI.
    files: ['supabase/functions/**/*.ts'],
    rules: {
      'no-console': 'error',
      'no-undef': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'none',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@/*', '../../../*', '../../../../*', '../../../../../*'],
          paths: [
            {
              name: '@supabase/supabase-js',
              message: 'Import @supabase/supabase-js only in client factory files.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/lib/supabase/create-client-factory.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['supabase/functions/_shared/log.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
      'no-undef': 'off',
    },
  },
);
