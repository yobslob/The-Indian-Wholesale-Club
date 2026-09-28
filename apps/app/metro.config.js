const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro resolve packages from the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// The website uses React 19 and the app React 18 (Expo SDK 52), so the monorepo holds both.
// Every React / React Native import in the bundle must get the app's own copy (one React).
const SINGLETONS = /^(react|react-dom|react-native)(\/.*)?$/;
const appOrigin = path.join(projectRoot, 'package.json');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // `@/…` = the app folder. Metro's own tsconfig "paths" support is off (app.json
  // experiments.tsconfigPaths): the tsconfig maps `react` to its type package for tsc only.
  if (moduleName.startsWith('@/')) {
    return context.resolveRequest(context, path.join(projectRoot, moduleName.slice(2)), platform);
  }
  // Workspace packages are imported by subpath (`@repo/db/store`, `@repo/shared/domain`).
  // Resolve those through each package's "exports" map, whatever Metro's own setting.
  const match = /^@repo\/([^/]+)\/(.+)$/.exec(moduleName);
  if (match) {
    const packageDir = path.join(monorepoRoot, 'packages', match[1]);
    const manifest = path.join(packageDir, 'package.json');
    if (fs.existsSync(manifest)) {
      const target = JSON.parse(fs.readFileSync(manifest, 'utf8')).exports?.[`./${match[2]}`];
      if (typeof target === 'string') {
        return { type: 'sourceFile', filePath: path.join(packageDir, target) };
      }
    }
  }
  if (SINGLETONS.test(moduleName)) {
    return context.resolveRequest(
      { ...context, originModulePath: appOrigin },
      moduleName,
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
