/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['@repo/eslint-config/next'],
  parserOptions: {
    project: true,
  },
  ignorePatterns: ['next-env.d.ts', '.next/**', 'node_modules/**'],
  overrides: [
    {
      // Import boundaries (engineering.md §Code conventions, D-006): customer code never
      // pulls in admin code, so admin JavaScript is never shipped to customers.
      files: [
        'app/(store)/**/*.{ts,tsx}',
        'app/api/**/*.ts',
        'app/*.{ts,tsx}',
        'features/!(admin)/**/*.{ts,tsx}',
        'lib/**/*.{ts,tsx}',
        'middleware.ts',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@/features/admin', '@/features/admin/*', '@/app/admin', '@/app/admin/*', '@repo/shared/admin'],
                message: 'Storefront code must not import admin code (D-006, engineering.md).',
              },
              {
                group: ['@repo/db/admin'],
                message: 'Customer code reads only store_* data via @repo/db/store (D-017).',
              },
            ],
          },
        ],
      },
    },
  ],
};
