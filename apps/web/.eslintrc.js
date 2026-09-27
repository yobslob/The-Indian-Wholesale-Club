/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['@repo/eslint-config/next'],
  parserOptions: {
    project: true,
  },
  ignorePatterns: ['next-env.d.ts', '.next/**', 'node_modules/**'],
};
