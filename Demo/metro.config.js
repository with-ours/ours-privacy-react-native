const path = require('path');
const fs = require('fs');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

// Minimal .env reader so this works on a fresh clone without adding a runtime dep.
// We can't use react-native-dotenv here — that's a babel plugin and runs after
// metro.config.js has already loaded.
function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(rawLine);
    if (!match) continue;
    out[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const envFromFile = readEnvFile(path.resolve(__dirname, '.env'));
const sdkSource =
  process.env.OURSPRIVACY_SDK_SOURCE || envFromFile.OURSPRIVACY_SDK_SOURCE || 'npm';
const useLocalSdk = sdkSource === 'local';
const sdkRoot = path.resolve(__dirname, '..');

console.log(
  `[metro] @oursprivacy/react-native source: ${useLocalSdk ? `local (${sdkRoot})` : 'npm'}`,
);

const localOverrides = useLocalSdk
  ? {
      watchFolders: [sdkRoot],
      resolver: {
        // When the SDK source (outside Demo/) imports react / react-native /
        // async-storage, force resolution through Demo/node_modules so we don't
        // bundle two copies. The Proxy returns Demo/node_modules/<name> for any
        // module not explicitly aliased.
        extraNodeModules: new Proxy(
          {'@oursprivacy/react-native': sdkRoot},
          {
            get(target, name) {
              if (name in target) return target[name];
              return path.resolve(__dirname, 'node_modules', name);
            },
          },
        ),
      },
    }
  : {};

module.exports = mergeConfig(getDefaultConfig(__dirname), localOverrides);
