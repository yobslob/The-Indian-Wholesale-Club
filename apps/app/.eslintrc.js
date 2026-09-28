/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['@repo/eslint-config/react-native'],
  parserOptions: {
    project: true,
  },
  overrides: [
    {
      // Import boundaries (engineering.md, D-006): customer screens never import admin code.
      files: [
        'app/(customer)/**/*.{ts,tsx}',
        'app/auth/**/*.{ts,tsx}',
        'app/region/**/*.{ts,tsx}',
        'app/product/**/*.{ts,tsx}',
        'app/order/**/*.{ts,tsx}',
        'app/*.{ts,tsx}',
        'features/!(admin)/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'lib/**/*.{ts,tsx}',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@/features/admin', '@/features/admin/*', '@/app/admin', '@/app/admin/*'],
                message: 'Customer screens must not import admin code (D-006, engineering.md).',
              },
              {
                group: ['@repo/db/admin', '@repo/db/server'],
                message: 'Customer screens read only store_* data via @repo/db/store (D-017).',
              },
            ],
          },
        ],
      },
    },
  ],
};
