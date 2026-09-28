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

// Workspace packages are imported by subpath (`@repo/db/store`, `@repo/shared/domain`).
// Resolve those through each package's "exports" map, whatever Metro's own setting.
config.resolver.resolveRequest = (context, moduleName, platform) => {
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
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
