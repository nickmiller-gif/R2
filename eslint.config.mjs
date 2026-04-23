import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'database.types.ts'],
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
        ...globals.deno,
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
    files: ['supabase/functions/**/*.ts'],
    rules: {
      'no-console': 'error',
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
);
