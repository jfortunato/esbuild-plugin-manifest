# esbuild-plugin-manifest

This plugin will generate a manifest.json file, mapping original asset names to their corresponding output name.

## Install

```bash
npm install --save-dev esbuild esbuild-plugin-manifest
```

## Usage

Create file `build.js`:

```js
const esbuild = require('esbuild');
const manifestPlugin = require('esbuild-plugin-manifest')

esbuild.build({
    entryPoints: ['src/index.js'],
    bundle: true,
    outfile: 'bundle.js',
    plugins: [manifestPlugin()],
}).catch((e) => console.error(e.message))
```
