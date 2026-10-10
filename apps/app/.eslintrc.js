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
                group: ['@/features/admin', '@/features/admin/*', '@/app/admin', '@/app/admin/*', '@repo/shared/admin'],
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
    {
      // Vendor mode (D-102, D-103): never admin or server code; vendors see only their own (INV-10).
      files: ['app/vendor/**/*.{ts,tsx}', 'features/vendor/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@/features/admin', '@/features/admin/*', '@/app/admin', '@/app/admin/*', '@repo/shared/admin', '@repo/db/admin', '@repo/db/server'],
                message: 'Vendor screens must not import admin or server code (D-103, INV-10).',
              },
            ],
          },
        ],
      },
    },
    {
      // Customer screens never pull in vendor screens (D-003: nothing about shops on a customer surface).
      files: ['app/(customer)/**/*.{ts,tsx}', 'app/region/**/*.{ts,tsx}', 'app/product/**/*.{ts,tsx}', 'app/order/**/*.{ts,tsx}', 'features/!(admin|vendor)/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@/features/vendor', '@/features/vendor/*', '@/app/vendor', '@/app/vendor/*', '@repo/db/vendor'],
                message: 'Customer screens must not import vendor code (D-003, D-103).',
              },
              {
                group: ['@/features/admin', '@/features/admin/*', '@/app/admin', '@/app/admin/*', '@repo/shared/admin'],
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
