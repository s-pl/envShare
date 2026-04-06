#!/usr/bin/env node
// Build script: bundles the CLI to a single ESM .js file ready for @yao-pkg/pkg
import * as esbuild from 'esbuild';

const version = process.argv[2] || '0.0.0';

const result = await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'bundle.mjs',
  external: ['fsevents'],
  // CJS packages (like commander) use require() at runtime. When bundled to ESM,
  // esbuild's CJS shim falls back to a no-op require stub that throws. Injecting
  // a real require via createRequire fixes all dynamic require() calls in the bundle.
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
  define: {
    '__ENVSHARE_VERSION__': JSON.stringify(version),
    '__GITHUB_REPO__': JSON.stringify(process.env.GITHUB_REPO || ''),
    '__BUILD_DATE__': JSON.stringify(new Date().toISOString()),
    'process.env.DEV': JSON.stringify('false'),
  },
  logLevel: 'info',
});

if (result.errors.length) process.exit(1);

// Step 2: Re-bundle the ESM output to CJS for pkg packaging.
// Re-processing as CJS converts all node: import statements to require() calls,
// producing a file pkg can snapshot.
const result2 = await esbuild.build({
  entryPoints: ['bundle.mjs'],
  bundle: false,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'bundle.cjs',
  // Replace import.meta.url with a CJS-compatible equivalent so that
  // createRequire() and fileURLToPath() calls work in the CJS bundle.
  define: {
    'import.meta.url': '__importMetaUrl__',
  },
  banner: {
    js: `const __importMetaUrl__ = require('url').pathToFileURL(__filename).href;`,
  },
  logLevel: 'info',
});

if (result2.errors.length) process.exit(1);
